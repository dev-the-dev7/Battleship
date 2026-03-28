// ============================================================
// GAME ENGINE - server-side game logic.
// The server is the authority on game state. All inputs from
// clients are validated here before being applied.
// ============================================================

// ---- State factories ----

function createGame(playerCount = 2, settings = {}) {
	const { width = 10, length = 10, mode = '1v1' } = settings;
	return {
		width,
		length,
		mode,
		turnIndex: 0,       // index into players[] - whose turn it currently is
		status:    'placing', // 'placing' | 'playing' | 'finished'
		winner:    null,      // player index of the winner
		players:   Array.from({ length: playerCount }, () => createPlayerState()),
	};
}

function createPlayerState() {
	return {
		ships:       [], // { id, type, len, align, sunk: false }
		cells:       [], // { shipId: null, hit: false, miss: false, sunk: false }
		shipsPlaced: false,
		shipsLeft:   0,
		status:      'active', // 'active' | 'eliminated' | 'surrendered'
	};
}

// ---- Placement ----

// Record player[playerIndex]'s ship placements.
// ships pre-validated by validate.js this function does geometric checks.
function placeShips(game, playerIndex, ships) {
	const player = game.players[playerIndex];
	if (!player)            return { valid: false, error: 'Invalid player index' };
	if (player.shipsPlaced) return { valid: false, error: 'Ships already placed' };
	if (game.status !== 'placing') {
		return { valid: false, error: 'Not in placement phase' };
	}

	const { width, length } = game;
	const total = width * length;

	// Build cell map: index -> shipId (null = water)
	const cells = Array.from({ length: total }, () => ({
		shipId: null,
		hit:    false,
		miss:   false,
		sunk:   false,
	}));

	const playerShips = [];

	for (const ship of ships) {
		// Validate contiguity: indices must form a straight horizontal or vertical line.
		const contiguityError = checkContiguous(ship.indices, ship.align, width);
		if (contiguityError) return { valid: false, error: `Ship ${ship.id}: ${contiguityError}` };

		// Mark cells (overlap already caught by validate.js, but double-check here).
		for (const idx of ship.indices) {
			if (cells[idx].shipId !== null) {
				return { valid: false, error: `Ship ${ship.id}: overlaps another ship at cell ${idx}` };
			}
			cells[idx].shipId = ship.id;
		}

		playerShips.push({
			id:    ship.id,
			type:  ship.type,
			len:   ship.indices.length,
			align: ship.align,
			sunk:  false,
		});
	}

	player.cells       = cells;
	player.ships       = playerShips;
	player.shipsLeft   = playerShips.length;
	player.shipsPlaced = true;

	const allPlaced = game.players.every(p => p.shipsPlaced);
	if (allPlaced) game.status = 'playing';

	return { valid: true, allPlaced };
}

// Verify that `indices` form a contiguous horizontal or vertical line.
function checkContiguous(indices, align, width) {
	if (indices.length === 1) return null;

	const sorted = [...indices].sort((a, b) => a - b);
	const step   = align === 0 ? 1 : width;

	for (let i = 1; i < sorted.length; i++) {
		if (sorted[i] - sorted[i - 1] !== step) {
			return 'cells are not contiguous';
		}
		// For horizontal ships, no row-wrap allowed.
		if (align === 0) {
			if (Math.floor(sorted[i] / width) !== Math.floor(sorted[i - 1] / width)) {
				return 'horizontal ship wraps across rows';
			}
		}
	}

	return null;
}

// ---- Shot logic ----

// Apply a shot from players[shooterIndex] aimed at players[targetIndex] at grid position cellIndex.
// In 1v1 mode, targetIndex is always the one opponent.
// In FFA mode, shooters choose their target - the client sends targetIndex explicitly.
function applyShot(game, shooterIndex, targetIndex, cellIndex) {
	if (game.status !== 'playing') {
		return { valid: false, error: 'Game is not in progress' };
	}
	if (game.turnIndex !== shooterIndex) {
		return { valid: false, error: 'Not your turn' };
	}
	if (shooterIndex === targetIndex) {
		return { valid: false, error: 'Cannot shoot yourself' };
	}

	const target = game.players[targetIndex];
	if (!target || target.status !== 'active') {
		return { valid: false, error: 'Invalid target' };
	}

	const total = game.width * game.length;
	if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= total) {
		return { valid: false, error: 'Cell index out of bounds' };
	}

	const cell = target.cells[cellIndex];
	if (!cell) {
		return { valid: false, error: 'Invalid cell' };
	}
	if (cell.hit || cell.miss) {
		return { valid: false, error: 'Cell already shot' };
	}

	let hit         = false;
	let sunk        = false;
	let shipType    = null;
	let shipId      = null;
	let sunkIndices = [];

	// Record who fired this shot so RECONNECT_STATE can restore shooter colors.
	cell.shotBy = shooterIndex;

	if (cell.shipId !== null) {
		cell.hit = true;
		hit      = true;

		shipId = cell.shipId;

		// Check if every cell of this ship has been hit to determine if it's sunk.
		const shipCells = target.cells.reduce((acc, c, i) => {
			if (c.shipId === shipId) acc.push({ c, i });
			return acc;
		}, []);

		if (shipCells.every(({ c }) => c.hit)) {
			sunk     = true;
			shipType = target.ships.find(s => s.id === shipId)?.type ?? null;

			sunkIndices = shipCells.map(({ i }) => i);
			sunkIndices.forEach(i => { target.cells[i].sunk = true; });

			target.shipsLeft--;
			if (target.shipsLeft === 0) {
				target.status = 'eliminated';
			}
		}
	} else {
		cell.miss = true;
	}

	const eliminated = target.status === 'eliminated';
	const gameOver   = checkWinCondition(game);

	if (gameOver) {
		game.status = 'finished';
		// Winner is the last active player.
		game.winner = game.players.findIndex(p => p.status === 'active');
	} else {
		advanceTurn(game);
	}

	return { valid: true, hit, sunk, shipId: sunk ? shipId : null, shipType, sunkIndices, eliminated, gameOver };
}

// ---- Turn management ----

function advanceTurn(game) {
	const count = game.players.length;
	let next    = (game.turnIndex + 1) % count;
	let safety  = 0;
	while (game.players[next].status !== 'active' && safety++ < count) {
		next = (next + 1) % count;
	}
	game.turnIndex = next;
}

// ---- Win condition ----

function checkWinCondition(game) {
	return game.players.filter(p => p.status === 'active').length <= 1;
}

module.exports = { createGame, placeShips, applyShot, advanceTurn };
