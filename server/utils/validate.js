// ============================================================
// VALIDATE - shared input validators for REST and WebSocket layers.
// All functions return true/false (or an error string where noted).
// Keep this module pure: no I/O, no side-effects.
// ============================================================

// Player color pool - shared across auth and host handlers.
const COLOR_POOL = ['#4fc3f7', '#b39ddb', '#ffd54f', '#ffb74d', '#f48fb1', '#a5d6a7'];

// Canonical ship lengths. The server is the authority - lengths are never
// accepted from the client; only type and count are trusted from fleet payloads.
const SHIP_LENS = {
	carrier:    5,
	battleship: 4,
	cruiser:    3,
	submarine:  3,
	destroyer:  2,
};

// Room codes: exactly 6 chars from the same charset used by generateCode().
const ROOM_CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

// Player IDs: hex string produced by crypto.randomBytes(12).toString('hex') -> 24 chars.
const PLAYER_ID_RE = /^[0-9a-f]{24}$/;

// Display names: printable ASCII, 1–12 chars. HTML special chars < > & " are rejected.
const NAME_RE = /^[^\x00-\x1F\x7F<>&"]{1,12}$/;

// Allowed ship type strings (must match what the frontend sends).
const VALID_SHIP_TYPES = new Set(['carrier', 'battleship', 'cruiser', 'submarine', 'destroyer']);

// ---- Primitive checks ----

function isRoomCode(value) {
	return typeof value === 'string' && ROOM_CODE_RE.test(value);
}

function isPlayerId(value) {
	return typeof value === 'string' && PLAYER_ID_RE.test(value);
}

function isName(value) {
	return typeof value === 'string' && NAME_RE.test(value.trim());
}

// Safe integer in [min, max] inclusive.
function isInt(value, min, max) {
	return Number.isInteger(value) && value >= min && value <= max;
}

// ---- Settings validation ----

// Validate a settings object from UPDATE_SETTINGS.
// Returns null on success, or an error string.
function validateSettings(settings) {
	if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
		return 'settings must be an object';
	}

	const { width, length, mode, ships, firstTurn, playerCount, difficulty } = settings;

	if (!isInt(width,  5, 20)) return 'width must be an integer between 5 and 20';
	if (!isInt(length, 5, 20)) return 'length must be an integer between 5 and 20';
	if (mode !== undefined && mode !== '1v1' && mode !== 'ffa') return 'mode must be "1v1" or "ffa"';
	if (playerCount !== undefined && !isInt(playerCount, 2, 4)) return 'playerCount must be between 2 and 4';
	if (firstTurn !== undefined && !['random', 'winner', 'loser'].includes(firstTurn)) {
		return 'firstTurn must be "random", "winner", or "loser"';
	}
	if (difficulty !== undefined && !['easy', 'medium', 'hard'].includes(difficulty)) {
		return 'difficulty must be "easy", "medium", or "hard"';
	}

	if (ships !== undefined) {
		if (!ships || typeof ships !== 'object' || Array.isArray(ships)) return 'ships must be an object';

		for (const [type, count] of Object.entries(ships)) {
			if (!VALID_SHIP_TYPES.has(type))    return `ships.${type}: invalid ship type`;
			if (!isInt(count, 0, 4))            return `ships.${type}: count must be 0–4`;
		}

		// Must include at least one ship with count > 0.
		const hasShip = Object.values(ships).some(c => c > 0);
		if (!hasShip) return 'Fleet must include at least one ship';

		// Sanity: total occupied cells must not exceed 70% of the grid.
		const totalCells = Object.entries(ships).reduce((sum, [type, count]) => sum + (SHIP_LENS[type] ?? 0) * count, 0);
		if (totalCells > Math.floor(width * length * 0.7)) {
			return 'Fleet is too large for the grid';
		}
	}

	return null;
}

// ---- Ship placement validation ----

// Validate a ships array from PLACE_SHIPS.
// Pass `shipsConfig` (from room.settings.ships) to enforce exact fleet composition.
// Returns null on success, or a plain error string on failure.
function validateShips(ships, width, length, shipsConfig) {
	if (!Array.isArray(ships))  return 'ships must be an array';
	if (ships.length === 0)     return 'ships array is empty';
	if (ships.length > 20)      return 'Too many ships';

	const total     = width * length;
	const seenCells = new Set();
	const seenIds   = new Set();

	for (const [s, ship] of ships.entries()) {

		if (!ship || typeof ship !== 'object' || Array.isArray(ship)) {
			return `ships[${s}]: must be an object`;
		}

		// id
		if (!Number.isInteger(ship.id) || ship.id < 0 || ship.id > 99) {
			return `ships[${s}]: id must be an integer 0-99`;
		}
		if (seenIds.has(ship.id)) {
			return `ships[${s}]: duplicate ship id ${ship.id}`;
		}
		seenIds.add(ship.id);

		// type
		if (typeof ship.type !== 'string' || !VALID_SHIP_TYPES.has(ship.type)) {
			return `ships[${s}]: invalid type "${ship.type}"`;
		}

		// align
		if (ship.align !== 0 && ship.align !== 1) {
			return `ships[${s}]: align must be 0 (horizontal) or 1 (vertical)`;
		}

		// indices
		if (!Array.isArray(ship.indices)) {
			return `ships[${s}]: indices must be an array`;
		}
		if (ship.indices.length < 1 || ship.indices.length > 10) {
			return `ships[${s}]: indices length out of range`;
		}

		for (const idx of ship.indices) {
			if (!Number.isInteger(idx) || idx < 0 || idx >= total) {
				return `ships[${s}]: cell index ${idx} out of bounds`;
			}
			if (seenCells.has(idx)) {
				return `ships[${s}]: overlapping cell at index ${idx}`;
			}
			seenCells.add(idx);
		}
	}

	// ---- Fleet composition check ----
	if (shipsConfig) {
		// Build expected map from ships object using authoritative SHIP_LENS for lengths
		const expected = new Map(
			Object.entries(shipsConfig)
				.filter(([, count]) => count > 0)
				.map(([type, count]) => [type, { len: SHIP_LENS[type], count }])
		);
		const counts = new Map(); // type -> submitted count

		for (const ship of ships) {
			const spec = expected.get(ship.type);
			if (!spec) return `Ship type "${ship.type}" is not in the fleet configuration`;
			if (ship.indices.length !== spec.len) {
				return `Ship ${ship.id}: type "${ship.type}" must have length ${spec.len}, got ${ship.indices.length}`;
			}
			counts.set(ship.type, (counts.get(ship.type) ?? 0) + 1);
		}

		for (const [type, spec] of expected) {
			const got = counts.get(type) ?? 0;
			if (got !== spec.count) {
				return `Expected ${spec.count} "${type}" ship(s), got ${got}`;
			}
		}
	}

	return null; // valid
}

// ---- SHOOT validation ----

function validateShot(cellIndex, targetIndex, width, length, playerCount) {
	const total = width * length;
	if (!isInt(cellIndex, 0, total - 1))         return 'cellIndex out of bounds';
	if (targetIndex !== undefined &&
	    !isInt(targetIndex, 0, playerCount - 1))  return 'targetIndex out of bounds';
	return null;
}

module.exports = { COLOR_POOL, SHIP_LENS, isRoomCode, isPlayerId, isName, validateSettings, validateShips, validateShot };
