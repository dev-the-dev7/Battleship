// ============================================================
// LOBBY HANDLERS - LEAVE and LEAVE_GAME messages.
// ============================================================

const { getConnectedIndices }                             = require('../../game/roomManager');
const { broadcastExcept }                                 = require('../../utils/broadcast');
const { checkAndStartNoHumansTimer }                      = require('../../game/roomTimers');
const { disconnectSlot, tryMigrateHost, handleCpuTakeover } = require('../../game/roomActions');

// Explicit voluntary leave from the waiting room.
// Marks the slot vacant immediately so joinRoom can reuse it before the
// socket close event fires.
function handleLeave(ctx) {
	const { room, playerIndex } = ctx;
	if (!room || room.status !== 'joining') return;

	const p = room.players[playerIndex];
	if (!p || p.isCpu || p.disconnected) return;

	disconnectSlot(p);
	broadcastExcept(room, playerIndex, 'PLAYER_DISCONNECTED', { playerIndex, connectedIndices: getConnectedIndices(room) });
	tryMigrateHost(room, playerIndex);
	// ws.on('close') will fire next but will see p.disconnected == true and skip.
}

// Voluntary leave during an active game. Marks the slot disconnected and
// has the CPU take over.
function handleLeaveGame(ctx) {
	const { room, playerIndex } = ctx;
	if (!room || room.status === 'joining') return;

	const slot = room.players[playerIndex];
	if (!slot || slot.isCpu || slot.disconnected) return;

	disconnectSlot(slot);
	// ws.on('close') will see disconnected == true and skip.

	const { gameOverFired } = handleCpuTakeover(room, playerIndex);

	// Include nextTurnIndex only when the game is actively playing after takeover.
	const payload = (room.game && room.status === 'playing')
		? { playerIndex, nextTurnIndex: room.game.turnIndex }
		: { playerIndex };
	broadcastExcept(room, playerIndex, 'PLAYER_LEFT', payload);

	tryMigrateHost(room, playerIndex);
	if (!gameOverFired) checkAndStartNoHumansTimer(room);
}

module.exports = { handleLeave, handleLeaveGame };
