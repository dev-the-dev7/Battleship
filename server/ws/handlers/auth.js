// ============================================================
// AUTH HANDLER - handles the AUTH message (first message on
// every connection). Sets ctx.room / ctx.playerIndex / ctx.playerId
// and sends AUTH_OK (new player) or RECONNECT_STATE (CPU slot claim).
// ============================================================

const { getRoom, getPlayerIndex, getConnectedIndices } = require('../../game/roomManager');
const { send, broadcastExcept, buildReconnectState } = require('../../utils/broadcast');
const { isRoomCode, isPlayerId, isName, COLOR_POOL } = require('../../utils/validate');
const { clearNoHumansTimer }                      = require('../../game/roomTimers');

function handleAuth(ctx, { code, playerId: pid, name, avatar, color }) {
	const { ws } = ctx;

	if (typeof code !== 'string' || !isRoomCode(code.toUpperCase())) {
		return send(ws, 'ERROR', { message: 'Invalid room code' });
	}
	if (!isPlayerId(pid)) {
		return send(ws, 'ERROR', { message: 'Invalid player ID' });
	}

	const found = getRoom(code.toUpperCase());
	if (!found) return send(ws, 'ERROR', { message: 'Room not found' });

	const idx = getPlayerIndex(found, pid);
	console.log('[handleAuth] code=%s pidSuffix=...%s idx=%d status=%s', code, pid.slice(-6), idx, found.status);
	if (idx === -1) return send(ws, 'ERROR', { message: 'Invalid player ID' });

	const slot          = found.players[idx];
	const isCpuTakeover = slot.isCpu &&
		(found.status === 'idle' || found.status === 'playing');
	console.log('[handleAuth] isCpuTakeover=%s slot.isCpu=%s slot.disconnected=%s',
		isCpuTakeover, slot.isCpu, slot.disconnected);

	// Attach this connection to the slot and claim it as a human.
	slot.ws           = ws;
	slot.disconnected = false;
	slot.isCpu        = false;

	// Resolve color conflicts with other players.
	const takenColors = found.players.filter((p, i) => i !== idx && p.profile?.color).map(p => p.profile.color);
	let finalColor = COLOR_POOL.includes(color) ? color : null;
	if (finalColor && takenColors.includes(finalColor)) {
		const available = COLOR_POOL.filter(c => !takenColors.includes(c));
		if (available.length > 0) finalColor = available[0];
	}

	slot.profile = {
		name:   (typeof name === 'string' && isName(name)) ? name.trim() : null,
		avatar: avatar || null,
		color:  finalColor,
	};

	ctx.room        = found;
	ctx.playerId    = pid;
	ctx.playerIndex = idx;

	ctx.resetIdleTimer();

	// Cancel any close countdown - a human just connected.
	if (found.noHumansTimer) {
		clearNoHumansTimer(found);
		broadcastExcept(found, idx, 'ROOM_CLOSE_CANCELLED', {});
	}

	if (isCpuTakeover) {
		send(ws, 'RECONNECT_STATE', buildReconnectState(found, idx));
		const gamePlayer   = found.game?.players[idx];
		const playerStatus = gamePlayer?.status ?? 'active';
		broadcastExcept(found, idx, 'PLAYER_JOINED_MIDGAME', {
			playerIndex: idx,
			profile:     slot.profile,
			status:      playerStatus,
		});
		return;
	}

	const connectedIndices = getConnectedIndices(found);
	send(ws, 'AUTH_OK', {
		playerIndex:     idx,
		hostIndex:       found.hostIndex,
		playerCount:     found.players.length,
		connectedIndices,
		settings:        found.settings,
		profiles:        found.players.map(p => p.profile ?? null),
	});
	broadcastExcept(found, idx, 'PLAYER_JOINED', { playerIndex: idx, connectedIndices, profile: slot.profile });
}

module.exports = handleAuth;
