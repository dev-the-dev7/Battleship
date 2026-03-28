// ============================================================
// GAME HANDLERS - START_GAME, NEW_GAME, PLACE_SHIPS, SHOOT, SURRENDER.
// ============================================================

const { createPlayerEntry, resetForNewGame }              = require('../../game/roomManager');
const { send, broadcastAll }                              = require('../../utils/broadcast');
const { createGame, placeShips, applyShot, advanceTurn }  = require('../../game/gameEngine');
const { validateShips, validateShot }                     = require('../../utils/validate');
const { startIdleTimer, clearIdleTimer } = require('../../game/roomTimers');
const { applyFirstTurn, placeCpuShips, finalizeGameOver, fireCpuTurns } = require('../../game/roomActions');

function handleOpenGameView(ctx) {
	const { ws, room, playerIndex } = ctx;
	const { players, settings, hostIndex } = room;

	if (playerIndex !== hostIndex) {
		return send(ws, 'ERROR', { message: 'Only the host can start the game' });
	}
	if (room.status !== 'joining') {
		return send(ws, 'ERROR', { message: 'Not in the waiting room' });
	}

	const connectedHumans = players.filter(p => !p.isCpu && p.ws !== null).length;
	if (connectedHumans < 2) {
		return send(ws, 'ERROR', { message: 'Need at least 2 players to start' });
	}

	room.status = 'idle';
	startIdleTimer(room);

	broadcastAll(room, 'GAME_VIEW_OPEN', {
		playerCount: settings.playerCount,
		settings,
		profiles:  players.map(p => p.profile || null),
		hostIndex,
	});
}

function handleNewGame(ctx) {
	const { ws, room, playerIndex } = ctx;
	const { players, settings, hostIndex } = room;

	if (playerIndex !== hostIndex) {
		return send(ws, 'ERROR', { message: 'Only the host can start a new game' });
	}
	if (room.status !== 'idle') {
		return send(ws, 'ERROR', { message: 'Game has already started' });
	}

	const connectedHumans = players.filter(p => !p.isCpu && p.ws !== null).length;
	if (connectedHumans < 2) {
		return send(ws, 'ERROR', { message: 'Need at least 2 players to start' });
	}

	clearIdleTimer(room);
	resetForNewGame(room);

	// Adjust CPU slot count to match the target player count.
	// Target CPUs = what settings ask for minus connected humans.
	// Current CPUs = slots actually marked isCpu (accounts for mid-game human joins).
	const targetCpus  = Math.max(0, settings.playerCount - connectedHumans);
	const currentCpus = room.players.filter(p => p.isCpu).length;
	const delta       = targetCpus - currentCpus;
	if (delta > 0) {
		for (let i = 0; i < delta; i++) room.players.push(createPlayerEntry(null, true));
	} else if (delta < 0) {
		let toRemove = -delta;
		for (let i = room.players.length - 1; i >= 0 && toRemove > 0; i--) {
			if (room.players[i].isCpu) { room.players.splice(i, 1); toRemove--; }
		}
	}

	const playerCount = players.length;
	room.game   = createGame(playerCount, settings);
	applyFirstTurn(room);
	room.status = 'playing';

	for (let i = 0; i < playerCount; i++) {
		if (players[i].isCpu) placeCpuShips(room, i);
	}

	const profiles = players.map(p => (p.isCpu ? null : (p.profile || null)));
	broadcastAll(room, 'NEW_GAME', { settings, profiles, playerCount });
}

function handlePlaceShips(ctx, { ships }) {
	const { ws, room, playerIndex } = ctx;
	if (!room.game) return send(ws, 'ERROR', { message: 'Game not started yet' });

	const { game, settings } = room;
	const shipError = validateShips(ships, game.width, game.length, settings.ships);
	if (shipError) return send(ws, 'ERROR', { message: shipError });

	const result = placeShips(game, playerIndex, ships);
	if (!result.valid) return send(ws, 'ERROR', { message: result.error });

	send(ws, 'SHIPS_PLACED_ACK', {});

	if (result.allPlaced) {
		broadcastAll(room, 'GAME_START', { firstTurnIndex: game.turnIndex });
		fireCpuTurns(room);
	}
}

function handleShoot(ctx, { targetIndex, cellIndex }) {
	const { ws, room, playerIndex } = ctx;
	if (!room.game) return send(ws, 'ERROR', { message: 'Game not started yet' });

	const { game, players } = room;
	const playerCount    = players.length;
	const resolvedTarget = playerCount === 2 ? 1 - playerIndex : targetIndex;

	const shotError = validateShot(cellIndex, resolvedTarget, game.width, game.length, playerCount);
	if (shotError) return send(ws, 'ERROR', { message: shotError });

	const result = applyShot(game, playerIndex, resolvedTarget, cellIndex);
	if (!result.valid) return send(ws, 'ERROR', { message: result.error });

	const nextTurnIndex = result.gameOver ? null : game.turnIndex;

	broadcastAll(room, 'SHOT', {
		shooterIndex: playerIndex,
		targetIndex:  resolvedTarget,
		cellIndex,
		nextTurnIndex,
		...result,
	});

	if (result.gameOver) {
		finalizeGameOver(room);
	} else {
		fireCpuTurns(room);
	}
}

function handleSurrender(ctx) {
	const { ws, room, playerIndex } = ctx;
	if (!room.game || room.status !== 'playing') {
		return send(ws, 'ERROR', { message: 'No active game to surrender' });
	}

	const { game, players } = room;
	const gp = game.players[playerIndex];
	if (!gp || gp.status !== 'active') {
		return send(ws, 'ERROR', { message: 'Already eliminated or surrendered' });
	}

	gp.status    = 'surrendered';
	gp.shipsLeft = 0;

	const alive = game.players.filter(p => p.status === 'active');

	if (alive.length <= 1) {
		broadcastAll(room, 'PLAYER_SURRENDERED', { playerIndex, nextTurnIndex: null });
		finalizeGameOver(room);
	} else {
		if (game.turnIndex === playerIndex) advanceTurn(game);
		const nextTurn = game.turnIndex;
		console.log('[surrender] player=%d eliminated. alive=%d nextTurnIndex=%d isCpu=%s',
			playerIndex, alive.length, nextTurn, !!players[nextTurn]?.isCpu);
		broadcastAll(room, 'PLAYER_SURRENDERED', { playerIndex, nextTurnIndex: nextTurn });
		fireCpuTurns(room);
	}
}

module.exports = { handleOpenGameView, handleNewGame, handlePlaceShips, handleShoot, handleSurrender };
