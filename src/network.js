// ============================================================
// NETWORK - all backend communication isolated here.
// Nothing outside this module calls fetch() or new WebSocket().
// The rest of the app calls these functions and subscribes via onEvent().
// ============================================================

let socket     = null;
const handlers = {};

// ---- WebSocket connection ----

// Dev helper - exposes a manual disconnect in the browser console for testing unexpected drop behavior.
if (location.hostname === 'localhost') window.__devDisconnect = () => { socket?.close(); };

export function connect(wsUrl) {
	return new Promise((resolve, reject) => {
		socket = new WebSocket(wsUrl);

		socket.addEventListener('open', resolve);
		socket.addEventListener('error', reject);

		socket.addEventListener('message', (e) => {
			let msg;
			try { msg = JSON.parse(e.data); } catch { return; }
			const { type, payload } = msg;
			// Defer each handler to its own macrotask so the browser can repaint
			// between consecutive messages (e.g. SHOT then GAME_OVER).
			setTimeout(() => handlers[type]?.(payload), 0);
		});

		socket.addEventListener('close', () => {
			handlers['DISCONNECT']?.();
		});
	});
}

export function disconnect() {
	if (socket) {
		// Clear the DISCONNECT handler so an intentional close doesn't trigger
		// navigation logic that was registered for unexpected drops.
		delete handlers['DISCONNECT'];
		socket.close();
		socket = null;
	}
}

// Notify the server of a voluntary leave before closing the socket.
// This lets the server free the slot immediately, avoiding the race between
// the REST joinRoom call and the ws close event on the server side.
export function sendLeave() {
	send({ type: 'LEAVE', payload: {} });
}

// Subscribe to a server-sent event type. callback receives the payload.
export function onEvent(type, callback) {
	handlers[type] = callback;
}

// ---- REST API ----

async function parseResponse(res, fallback) {
	if (!res.ok) {
		const { error } = await res.json().catch(() => ({}));
		throw new Error(error || fallback);
	}
	return res.json();
}

// Create a new game room. Returns { code, playerId }.
export async function createRoom() {
	const res = await fetch('/api/rooms', { method: 'POST' });
	return parseResponse(res, 'Failed to create room');
}

// Join an existing room by its code. Returns { code, playerId }.
// Works during an active game if a CPU-replaced slot is available.
export async function joinRoom(code) {
	const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/join`, { method: 'POST' });
	return parseResponse(res, 'Room not found or full');
}

// ---- WebSocket messages ----

// Authenticate this connection as a specific player in a room.
// profile: { name, avatar, color } - shared with all other players.
// Call once immediately after connect().
export function auth(code, playerId, profile = {}) {
	send({ type: 'AUTH', payload: { code, playerId, ...profile } });
}

// Send confirmed ship placements. ships: [{ id, type, align, indices }]
export function sendPlacement(ships) {
	send({ type: 'PLACE_SHIPS', payload: { ships } });
}

// Send a shot. targetIndex can be omitted in 1v1 - server resolves it.
export function sendShot(cellIndex, targetIndex) {
	send({ type: 'SHOOT', payload: { cellIndex, targetIndex } });
}

// Send updated game settings (host only, not during a game).
export function sendSettings(settings) {
	send({ type: 'UPDATE_SETTINGS', payload: settings });
}

// Update this player's profile - not mid-game.
export function sendUpdateProfile(profile) {
	send({ type: 'UPDATE_PROFILE', payload: profile });
}

// Open the game view (host only, from the waiting room).
export function sendStartGame() {
	send({ type: 'START_GAME', payload: {} });
}

// Start a new game or rematch (host only, from the game view).
export function sendNewGame() {
	send({ type: 'NEW_GAME', payload: {} });
}

// Surrender the current game.
export function sendSurrender() {
	send({ type: 'SURRENDER', payload: {} });
}

// Voluntarily leave the game - CPU takes over the slot.
export function sendLeaveGame() {
	send({ type: 'LEAVE_GAME', payload: {} });
}

// Kick a player from the room (host only, waiting room).
export function sendKickPlayer(targetIndex) {
	send({ type: 'KICK_PLAYER', payload: { targetIndex } });
}

function send(message) {
	if (!socket || socket.readyState !== WebSocket.OPEN) {
		console.warn('WebSocket not connected - message dropped:', message.type);
		return;
	}
	socket.send(JSON.stringify(message));
}
