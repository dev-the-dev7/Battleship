// ============================================================
// HOST HANDLERS - UPDATE_PROFILE, UPDATE_SETTINGS, KICK_PLAYER.
// ============================================================

const { getConnectedIndices, updateSettings } = require('../../game/roomManager');
const { send, broadcastAll, broadcastExcept }             = require('../../utils/broadcast');
const { validateSettings, COLOR_POOL }                    = require('../../utils/validate');

// ---- Profile update (any player, not mid-game) ----

function handleUpdateProfile(ctx, { color }) {
	const { ws, room, playerIndex } = ctx;
	if (!room || (room.status !== 'joining' && room.status !== 'idle')) return;
	const p = room.players[playerIndex];
	if (!p || p.isCpu) return;
	if (color) {
		if (!COLOR_POOL.includes(color)) return send(ws, 'ERROR', { message: 'Invalid color' });
		p.profile = { ...p.profile, color };
	}
	broadcastExcept(room, playerIndex, 'PLAYER_PROFILE_UPDATED', { playerIndex, profile: p.profile });
}

// ---- Settings (host only, not mid-game) ----

function handleUpdateSettings(ctx, payload) {
	const { ws, room, playerIndex } = ctx;
	if (playerIndex !== room.hostIndex) {
		return send(ws, 'ERROR', { message: 'Only the host can change settings' });
	}
	if (room.status === 'playing') {
		return send(ws, 'ERROR', { message: 'Cannot change settings during a game' });
	}

	const error = validateSettings(payload);
	if (error) return send(ws, 'ERROR', { message: error });

	updateSettings(room, payload);

	if (Number.isInteger(payload.playerCount) && payload.playerCount >= 2 && payload.playerCount <= 4) {
		room.settings.mode = payload.playerCount > 2 ? 'ffa' : '1v1';
	}

	broadcastAll(room, 'SETTINGS_UPDATED', room.settings);
}

// ---- Kick player (host only, joining status only) ----

function handleKickPlayer(ctx, { targetIndex: rawTargetIndex }) {
	const { ws, room, playerIndex } = ctx;
	if (playerIndex !== room.hostIndex) {
		return send(ws, 'ERROR', { message: 'Only the host can kick players' });
	}
	if (room.status !== 'joining') {
		return send(ws, 'ERROR', { message: 'Cannot kick during an active game' });
	}

	const targetIndex = Number(rawTargetIndex);
	if (!Number.isInteger(targetIndex) || targetIndex === playerIndex) {
		return send(ws, 'ERROR', { message: 'Invalid target' });
	}

	const target = room.players[targetIndex];
	if (!target || target.isCpu || target.disconnected || !target.ws) {
		return send(ws, 'ERROR', { message: 'Invalid target' });
	}

	const kickedWs      = target.ws;
	target.ws           = null;
	target.disconnected = true;
	// Clear the profile so the slot is treated as CPU when NEW_GAME profiles are sent.
	target.profile      = null;

	send(kickedWs, 'KICKED', { reason: 'Removed by host' });
	kickedWs.close(1000, 'Kicked by host');
	// ws.on('close') for kickedWs will see disconnected == true and skip.

	broadcastExcept(room, targetIndex, 'PLAYER_KICKED', {
		playerIndex:      targetIndex,
		isCpu:            target.isCpu,
		connectedIndices: getConnectedIndices(room),
	});
}

module.exports = { handleUpdateProfile, handleUpdateSettings, handleKickPlayer };
