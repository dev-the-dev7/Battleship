// ============================================================
// WEBSOCKET HANDLER - per-connection setup and message dispatch.
//
// All message handlers live in ./handlers/*.js and receive a
// mutable ctx object: { ws, room, playerIndex, playerId, resetIdleTimer }.
//
// ws.on('close') stays here because it needs mutable closure state
// (room, playerIndex) for the CPU-takeover logic on disconnect.
//
// Timer model:
//   IDLE_TIMEOUT_MS - per-connection, reset on every message.
//                     Kicks zombie/forgotten connections.
//   idleTimer       - per-room (roomTimers.js), starts when room enters 'idle'.
//                     Closes room after 30 min with no active game.
//   MAX_SESSION_MS  - per-room (roomTimers.js), starts when the
//                     game enters 'playing'.
// ============================================================

const { getConnectedIndices }											  = require('../game/roomManager');
const { send, broadcastExcept }                                           = require('../utils/broadcast');
const { checkAndStartNoHumansTimer }                                      = require('../game/roomTimers');
const { disconnectSlot, tryMigrateHost, handleCpuTakeover }               = require('../game/roomActions');

const handleAuth                                                          = require('./handlers/auth');
const { handleLeave, handleLeaveGame }                                    = require('./handlers/lobby');
const { handleOpenGameView, handleNewGame, handlePlaceShips, handleShoot, handleSurrender } = require('./handlers/game');
const { handleUpdateProfile, handleUpdateSettings, handleKickPlayer }     = require('./handlers/host');

const MAX_MSG_BYTES    = 64 * 1024;
const RATE_LIMIT_COUNT = 20;
const RATE_LIMIT_MS    = 5000;
const IDLE_TIMEOUT_MS  = 15 * 60 * 1000;

function handleConnection(ws) {
	const ctx = { ws, room: null, playerIndex: -1, playerId: null };

	let msgTimestamps = [];
	let idleTimer     = null;

	function resetIdleTimer() {
		clearTimeout(idleTimer);
		idleTimer = setTimeout(() => ws.terminate(), IDLE_TIMEOUT_MS);
	}
	ctx.resetIdleTimer = resetIdleTimer;

	ws.on('message', (data) => {
		if (Buffer.byteLength(data) > MAX_MSG_BYTES) {
			return send(ws, 'ERROR', { message: 'Message too large' });
		}

		const now = Date.now();
		msgTimestamps = msgTimestamps.filter(t => now - t < RATE_LIMIT_MS);
		if (msgTimestamps.length >= RATE_LIMIT_COUNT) {
			return send(ws, 'ERROR', { message: 'Rate limit exceeded' });
		}
		msgTimestamps.push(now);

		resetIdleTimer();

		let msg;
		try { msg = JSON.parse(data); } catch { return send(ws, 'ERROR', { message: 'Invalid JSON' }); }

		if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
			return send(ws, 'ERROR', { message: 'Malformed message' });
		}

		const { type, payload = {} } = msg;

		if (type !== 'AUTH' && ctx.playerIndex === -1) {
			return send(ws, 'ERROR', { message: 'Send AUTH first' });
		}

		switch (type) {
			case 'AUTH':             return handleAuth(ctx, payload);
			case 'LEAVE':            return handleLeave(ctx);
			case 'LEAVE_GAME':       return handleLeaveGame(ctx);
			case 'START_GAME':       return handleOpenGameView(ctx);
			case 'NEW_GAME':         return handleNewGame(ctx);
			case 'PLACE_SHIPS':      return handlePlaceShips(ctx, payload);
			case 'SHOOT':            return handleShoot(ctx, payload);
			case 'UPDATE_SETTINGS':  return handleUpdateSettings(ctx, payload);
			case 'UPDATE_PROFILE':   return handleUpdateProfile(ctx, payload);
			case 'KICK_PLAYER':      return handleKickPlayer(ctx, payload);
			case 'SURRENDER':        return handleSurrender(ctx);
			default: send(ws, 'ERROR', { message: `Unknown message type: ${type}` });
		}
	});

	// ---- Disconnect ----
	ws.on('close', () => {
		clearTimeout(idleTimer);
		const { room, playerIndex } = ctx;
		console.log('[ws.close] playerIndex=%d room=%s status=%s', playerIndex, room?.code, room?.status);
		if (!room) return;

		const slot = room.players[playerIndex];
		if (!slot || slot.isCpu) return;
		if (slot.disconnected) return; // Already handled by LEAVE / LEAVE_GAME

		disconnectSlot(slot);

		const { gameOverFired } = handleCpuTakeover(room, playerIndex);
		tryMigrateHost(room, playerIndex);

		const disconnPayload = { playerIndex, connectedIndices: getConnectedIndices(room) };
		if (room.game && room.status === 'playing') disconnPayload.nextTurnIndex = room.game.turnIndex;
		broadcastExcept(room, playerIndex, 'PLAYER_DISCONNECTED', disconnPayload);

		if (!gameOverFired) checkAndStartNoHumansTimer(room);
	});
}

module.exports = handleConnection;
