// ============================================================
// GAME RULES - pure functions only. No DOM. No imports.
// Input/output: plain objects and primitives only.
// ============================================================

// ---- State factories ----

// Create an initialized cell array for a grid of width × length.
// Each cell: { shipId: null, hit: false, miss: false, sunk: false }
export function initCells(width, length) {
	return Array.from({ length: width * length }, () => ({
		shipId: null,
		hit:    false,
		miss:   false,
		sunk:   false,
	}));
}

// Create a player state object.
export function createPlayer(shipCount) {
	return {
		ships:      [], // populated during placement
		cells:      [], // populated by initCells() when New Game starts
		shipsLeft:  shipCount,
		status:     'active',
		isCpu:      false,
		shotColors: {},
	};
}

// ---- Ship management ----

// Default ship configuration: one of each type.
export function defaultShipConfig() {
	return { carrier: 1, battleship: 1, cruiser: 1, submarine: 1, destroyer: 1 };
}

// Total ship count from a config object.
export function shipTotal(config) {
	return Object.values(config).reduce((sum, n) => sum + n, 0);
}

// Create a single ship plain object.
export function createShip(id, type, len, align) {
	return { id, type, len, originalLen: len, align, sunk: false };
}

// Canonical ship lengths for the client. Shared across placement, display, and AI logic.
export const SHIP_LENS = {
	carrier:    5,
	battleship: 4,
	cruiser:    3,
	submarine:  3,
	destroyer:  2,
};

// Create all ships for a player from a config object.
// Returns an array of ship plain objects with randomly chosen alignments.
export function createShips(config) {
	const ships = [];
	for (const [key, len] of Object.entries(SHIP_LENS)) {
		const count = config[key] ?? 0;
		for (let i = 0; i < count; i++) {
			ships.push(createShip(ships.length, key, len, Math.floor(Math.random() * 2)));
		}
	}
	return ships;
}

// ---- Grid geometry ----

// Return the grid indices a ship occupies, given its starting position.
// align: 0 = horizontal, 1 = vertical
export function getShipIndices(width, align, shipLen, start) {
	return align === 0
		? Array.from({ length: shipLen }, (_, i) => start + i)
		: Array.from({ length: shipLen }, (_, i) => start + i * width);
}

// Find a random valid set of indices to place a ship on cells[].
// Returns null if no valid position is found within maxAttempts (grid too full).
export function randomPlacementIndices(cells, width, length, ship, maxAttempts = 500) {
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const rangex = ship.align === 0 ? width - ship.len + 1 : width;
		const rangey = ship.align === 1 ? length - ship.len + 1 : length;
		const start = Math.floor(Math.random() * rangey) * width + Math.floor(Math.random() * rangex);
		const indices = getShipIndices(width, ship.align, ship.len, start);
		if (!indices.some(i => cells[i].shipId !== null)) return indices;
	}
	return null;
}

// Place a ship onto cells[] at the given indices.
export function placeShip(cells, ship, indices) {
	indices.forEach(i => { cells[i].shipId = ship.id; });
}

// ---- Shot logic ----

// Returns true if the shot at index is a legal move (not already shot there).
export function isValidShot(player, index) {
	const cell = player.cells[index];
	return cell !== undefined && !cell.hit && !cell.miss;
}

// Apply a shot to a player's grid. Mutates player state.
// Returns a result object describing what happened.
export function applyShot(player, index) {
	const cell = player.cells[index];

	if (cell.shipId !== null) {
		cell.hit = true;
		const ship = player.ships[cell.shipId];
		ship.len--;

		if (ship.len === 0) {
			ship.sunk = true;
			player.shipsLeft--;
			const sunkIndices = getSunkIndices(player, ship.id);
			sunkIndices.forEach(i => { player.cells[i].sunk = true; });

			return {
				hit:        true,
				sunk:       true,
				shipId:     ship.id,
				shipType:   ship.type,
				sunkIndices,
				gameOver:   player.shipsLeft === 0,
			};
		}

		return { hit: true, sunk: false, shipId: cell.shipId, gameOver: false };
	}

	cell.miss = true;
	return { hit: false, sunk: false, gameOver: false };
}

// Return all cell indices belonging to a specific ship.
export function getSunkIndices(player, shipId) {
	return player.cells.reduce((acc, cell, i) => {
		if (cell.shipId === shipId) acc.push(i);
		return acc;
	}, []);
}
