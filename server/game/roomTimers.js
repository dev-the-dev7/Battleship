// ============================================================
// ROOM TIMERS - per-room lifecycle timers.
//
// Each timer is stored on the room object so it can be cancelled
// by any code that holds a reference to the room.
// ============================================================

const { getRoom, deleteRoom } = require('./roomManager');
const { broadcastAll }        = require('../utils/broadcast');

const MAX_SESSION_MS  = 12 * 60 * 60 * 1000;	// 12 hours - per room session
const IDLE_ROOM_MS    = 30 * 60 * 1000;			// 30 min - max time a room can sit idle with no active game
const CLOSE_WARN_MS   =  2 * 60 * 1000;			// 2 min - grace period / warning before any room close

// Start the idle room timer. Fires when a room sits in 'idle' (no active game) for too long.
// Broadcasts a ROOM_CLOSING warning 2 minutes before closing.
function startIdleTimer(room) {
	clearIdleTimer(room);

	room.idleWarnTimer = setTimeout(() => {
		const r = getRoom(room.code);
		if (!r || r.status !== 'idle') return;
		broadcastAll(r, 'ROOM_CLOSING', { reason: 'idle', duration: CLOSE_WARN_MS });
	}, IDLE_ROOM_MS - CLOSE_WARN_MS);

	room.idleTimer = setTimeout(() => {
		const r = getRoom(room.code);
		if (!r) return;
		broadcastAll(r, 'SESSION_EXPIRED', { message: 'Room closed - no game started.' });
		setTimeout(() => deleteRoom(r.code), 3000);
	}, IDLE_ROOM_MS);
}

function clearIdleTimer(room) {
	if (room.idleWarnTimer) { clearTimeout(room.idleWarnTimer); room.idleWarnTimer = null; }
	if (room.idleTimer)     { clearTimeout(room.idleTimer);     room.idleTimer     = null; }
}

// Start the per-room max-session timer.
// Broadcasts a ROOM_CLOSING warning 2 minutes before the session actually expires.
function startSessionTimer(room) {
	clearSessionTimer(room);

	room.sessionWarnTimer = setTimeout(() => {
		const r = getRoom(room.code);
		if (!r) return;
		broadcastAll(r, 'ROOM_CLOSING', { reason: 'session', duration: CLOSE_WARN_MS });
	}, MAX_SESSION_MS - CLOSE_WARN_MS);

	room.sessionTimer = setTimeout(() => {
		const r = getRoom(room.code);
		if (!r) return;
		broadcastAll(r, 'SESSION_EXPIRED', { message: 'Session time limit reached.' });
		setTimeout(() => deleteRoom(r.code), 5000);
	}, MAX_SESSION_MS);
}

function clearSessionTimer(room) {
	if (room.sessionWarnTimer) { clearTimeout(room.sessionWarnTimer); room.sessionWarnTimer = null; }
	if (room.sessionTimer)     { clearTimeout(room.sessionTimer);     room.sessionTimer     = null; }
}

// Start the one-human countdown. Fires if the last human doesn't leave or a second human doesn't
// join within CLOSE_WARN_MS. Broadcasts ROOM_CLOSING so the remaining client sees a countdown.
function startNoHumansTimer(room) {
	clearNoHumansTimer(room);
	broadcastAll(room, 'ROOM_CLOSING', { reason: 'one_human', duration: CLOSE_WARN_MS });
	room.noHumansTimer = setTimeout(() => {
		const r = getRoom(room.code);
		if (!r) return;
		broadcastAll(r, 'SESSION_EXPIRED', { message: 'Room closed - no players remaining.' });
		setTimeout(() => deleteRoom(r.code), 3000);
	}, CLOSE_WARN_MS);
}

function clearNoHumansTimer(room) {
	if (room.noHumansTimer) {
		clearTimeout(room.noHumansTimer);
		room.noHumansTimer = null;
	}
}

function countConnectedHumans(room) {
	return room.players.filter(p => !p.isCpu && !p.disconnected && p.ws !== null).length;
}

// Called after any disconnect/leave in any room state.
// 0 humans -> delete the room immediately.
// 1 human  -> start a 2-min countdown; a second human joining cancels it.
function checkAndStartNoHumansTimer(room) {
	const connected = countConnectedHumans(room);
	if (connected === 0) {
		clearNoHumansTimer(room);
		clearIdleTimer(room);
		deleteRoom(room.code);
	} else if (connected === 1 && !room.noHumansTimer) {
		startNoHumansTimer(room);
	}
}

module.exports = {
	startIdleTimer, clearIdleTimer,
	startSessionTimer, clearSessionTimer,
	clearNoHumansTimer, checkAndStartNoHumansTimer,
};
