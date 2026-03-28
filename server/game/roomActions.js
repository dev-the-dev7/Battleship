// ============================================================
// ROOM ACTIONS - shared game-state mutations used by all
// message handlers. Keeps each handler file thin.
// ============================================================

const { generateId, migrateHost }                           = require('./roomManager');
const { placeShips, applyShot }                             = require('./gameEngine');
const { cpuPlaceShips, cpuPickShot, cpuPickTarget }         = require('./serverAi');
const { broadcastAll, buildReveal }                         = require('../utils/broadcast');
const { startIdleTimer } = require('./roomTimers');

function disconnectSlot(slot) {
	slot.ws           = null;
	slot.disconnected = true;
	slot.id           = generateId();
}

function tryMigrateHost(room, playerIndex) {
	if (playerIndex !== room.hostIndex) return;
	const nextHost = migrateHost(room, playerIndex);
	if (nextHost !== -1) broadcastAll(room, 'HOST_MIGRATED', { from: playerIndex, to: nextHost });
}

function finalizeGameOver(room) {
	room.game.winner     = room.game.players.findIndex(p => p.status === 'active');
	room.game.status     = 'finished';
	room.status          = 'idle';
	room.lastWinnerIndex = room.game.winner;
	startIdleTimer(room);
	broadcastAll(room, 'GAME_OVER', { winnerIndex: room.game.winner, reveal: buildReveal(room) });
}

function applyFirstTurn(room) {
	const ft     = room.settings.firstTurn || 'random';
	const n      = room.players.length;
	const winner = room.lastWinnerIndex;
	if (ft === 'winner' && winner != null) {
		room.game.turnIndex = winner % n;
	} else if (ft === 'loser' && winner != null) {
		// 2-player: loser is the other player; multi-player: next after winner
		room.game.turnIndex = (winner + 1) % n;
	} else {
		room.game.turnIndex = Math.floor(Math.random() * n);
	}
}

function placeCpuShips(room, playerIndex) {
	const ships = cpuPlaceShips(room.settings.ships, room.game.width, room.game.length);
	if (!ships) {
		console.error('[placeCpuShips] failed to place ships for player %d (grid too small?)', playerIndex);
		return false;
	}
	placeShips(room.game, playerIndex, ships);
	return true;
}

function fireCpuTurns(room) {
	while (room.game && room.game.status === 'playing') {
		const cpuIndex = room.game.turnIndex;
		if (!room.players[cpuIndex]?.isCpu) break;

		const targetIndex = cpuPickTarget(room.game, cpuIndex);
		if (targetIndex == null) {
			console.warn('[fireCpuTurns] cpuPickTarget returned null for cpuIndex=%d', cpuIndex);
			break;
		}

		const cellIndex = cpuPickShot(room.game.players[targetIndex], room.game.width, room.game.length, room.settings.difficulty);
		if (cellIndex == null) {
			console.warn('[fireCpuTurns] cpuPickShot returned null targeting player %d', targetIndex);
			break;
		}

		const result = applyShot(room.game, cpuIndex, targetIndex, cellIndex);
		if (!result.valid) {
			console.warn('[fireCpuTurns] applyShot invalid: %s (shooter=%d target=%d cell=%d turnIndex=%d)',
				result.error, cpuIndex, targetIndex, cellIndex, room.game.turnIndex);
			break;
		}

		broadcastAll(room, 'SHOT', {
			shooterIndex:  cpuIndex,
			targetIndex,
			cellIndex,
			nextTurnIndex: result.gameOver ? null : room.game.turnIndex,
			...result,
		});

		if (result.gameOver) {
			finalizeGameOver(room);
			break;
		}
	}
}

function handleCpuTakeover(room, playerIndex) {
	const slot = room.players[playerIndex];
	let gameOverFired = false;

	if (!room.game || room.status === 'idle') {
		slot.isCpu = true;
	} else if (room.status === 'playing') {
		slot.isCpu = true;
		if (room.game.status === 'placing' && !room.game.players[playerIndex].shipsPlaced) {
			placeCpuShips(room, playerIndex);
			if (room.game.status === 'playing') {
				broadcastAll(room, 'GAME_START', { firstTurnIndex: room.game.turnIndex });
			}
		}
		if (room.game.status === 'playing') {
			fireCpuTurns(room);
			if (room.status === 'idle') gameOverFired = true;
		}
	}

	return { gameOverFired };
}

module.exports = {
	disconnectSlot,
	tryMigrateHost,
	finalizeGameOver,
	applyFirstTurn,
	placeCpuShips,
	fireCpuTurns,
	handleCpuTakeover,
};
