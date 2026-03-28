// ============================================================
// ROOM MANAGER - in-memory room store.
//
// Players are stored as an ordered array so the room naturally
// scales from 2-player 1v1 to 4-player free-for-all without
// structural changes.
//
// CPU entries are appended to room.players by the WS handler
// at game start and adjusted to match live player state each rematch.
//
// For multi-process deployment, replace the Map with Redis.
// ============================================================

const crypto = require('crypto');
const rooms = new Map(); // rooms: Map<code, RoomState>
const MAX_PLAYERS = 4;
const DEFAULT_SETTINGS = {
	width:       10,
	length:      10,
	mode:        '1v1',
	difficulty:  'medium',
	playerCount: 2,
	ships: { carrier: 1, battleship: 1, cruiser: 1, submarine: 1, destroyer: 1 },
};

// ---- Room state shape ----
//
// {
//   code:      string,
//   hostIndex: number,				// index of the current host player (migrates on disconnect)
//   status:    'joining' | 'idle' | 'playing',
//   settings:  GameSettings,		// mutable by host between games
//   players: [
//     { id: string, ws: WebSocket | null, isCpu: false, disconnected: boolean, profile: object | null },
//     { id: string, ws: null,             isCpu: true,  disconnected: boolean, profile: null          },
//   ],
//   game: GameState | null,
//   createdAt: number,
//   idleWarnTimer: Timeout | null,  // warns 2 min before idle timeout fires
//   idleTimer:     Timeout | null,  // fires after 30 min with no active game; cancelled by handleNewGame
//   sessionTimer:  Timeout | null,  // max 12-hour session cap
//   noHumansTimer: Timeout | null,  // fires when only 1 human remains mid-game; cancelled on join
// }

function createRoom() {
	const code = generateCode();
	if (rooms.has(code)) return createRoom();

	const room = {
		code,
		hostIndex: 0,
		status:    'joining',
		settings:  { ...DEFAULT_SETTINGS, ships: { ...DEFAULT_SETTINGS.ships } },
		players:   [createPlayerEntry(generateId())],
		game:      null,
		createdAt: Date.now(),
		sessionTimer:  null, // cleared/restarted by ws/handler on game start and rematch
		noHumansTimer: null, // fires when only 1 human remains mid-game; cancelled on player join
	};

	rooms.set(code, room);
	return room;
}

// Add a human player to the room.
// During 'idle' or 'playing', claims the first available CPU slot instead.
function joinRoom(code) {
	const room = rooms.get(code);
	if (!room) return { error: 'Room not found' };

	// Mid-game join: claim any available CPU slot.
	if (room.status !== 'joining') {
		const slotIndex = room.players.findIndex(p => p.isCpu);
		if (slotIndex === -1) return { error: 'No open slots' };
		const playerId = generateId();
		// Assign the new id to the slot. CPU stays active until WS AUTH arrives.
		room.players[slotIndex].id = playerId;
		return { room, playerId };
	}

	const humanSlots = MAX_PLAYERS;

	// A slot is vacant if the player has disconnected OR their WebSocket is no
	// longer open. Checking readyState handles the race where the client calls
	// joinRoom before the server's ws.on('close') event fires (readyState 2 =
	// CLOSING, 3 = CLOSED). Slots with ws == null are fresh reservations that
	// haven't authenticated yet and must not be stolen.
	const isVacant = p =>
		!p.isCpu && (p.disconnected || (p.ws !== null && p.ws.readyState !== 1));

	const activeHumans = room.players.filter(p => !p.isCpu && !isVacant(p)).length;
	if (activeHumans >= humanSlots) return { error: 'Room is full' };

	const playerId = generateId();

	// Reuse a vacant slot so the player index stays stable for existing clients.
	const vacantIndex = room.players.findIndex(isVacant);
	if (vacantIndex !== -1) {
		room.players[vacantIndex] = createPlayerEntry(playerId);
		return { room, playerId };
	}

	// No vacant slot - append a new one.
	room.players.push(createPlayerEntry(playerId));
	return { room, playerId };
}

function getRoom(code) {
	return rooms.get(code) ?? null;
}

function getRoomCount() {
	return rooms.size;
}

function deleteRoom(code) {
	rooms.delete(code);
}

// Merge validated settings into the room's settings object.
// Only known fields are applied - unknown keys in the payload are ignored.
function updateSettings(room, settings) {
	const { width, length, mode, ships, firstTurn, playerCount, difficulty } = settings;
	if (width       !== undefined) room.settings.width       = width;
	if (length      !== undefined) room.settings.length      = length;
	if (mode        !== undefined) room.settings.mode        = mode;
	if (firstTurn   !== undefined) room.settings.firstTurn   = firstTurn;
	if (playerCount !== undefined) room.settings.playerCount = playerCount;
	if (difficulty  !== undefined) room.settings.difficulty  = difficulty;
	if (ships       !== undefined) room.settings.ships       = ships;
}

// Reset the room for a rematch. Clears the finished game state.
// CPU player entries are left for handleNewGame to adjust.
function resetForNewGame(room) {
	room.game = null;
}

// Return the index of a human player by their ID, or -1 if not found.
function getPlayerIndex(room, playerId) {
	return room.players.findIndex(p => p.id === playerId);
}


// ---- Helpers ----

// Factory for a fresh player slot entry.
function createPlayerEntry(id, isCpu = false) {
	return { id, ws: null, isCpu, disconnected: false, profile: null };
}

// Return the indices of all currently-connected human players.
function getConnectedIndices(room) {
	return room.players.reduce((acc, p, i) => {
		if (!p.isCpu && p.ws !== null) acc.push(i);
		return acc;
	}, []);
}

// Move the host role to the next connected human, excluding fromIndex.
// Updates room.hostIndex and returns the new host index, or -1 if none found.
function migrateHost(room, fromIndex) {
	const nextHost = room.players.findIndex((pl, i) =>
		i !== fromIndex && !pl.isCpu && !pl.disconnected && pl.ws !== null,
	);
	if (nextHost !== -1) room.hostIndex = nextHost;
	return nextHost;
}

function generateCode() {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const bytes = crypto.randomBytes(6);
	return Array.from(bytes, b => chars[b % chars.length]).join('');
}

function generateId() {
	return crypto.randomBytes(12).toString('hex');
}

module.exports = {
	createRoom, joinRoom, getRoom, getRoomCount, deleteRoom,
	updateSettings, resetForNewGame,
	getPlayerIndex,
	createPlayerEntry, getConnectedIndices, migrateHost,
	generateId,
};
