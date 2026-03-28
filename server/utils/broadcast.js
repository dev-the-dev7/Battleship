// ============================================================
// BROADCAST UTILITIES - low-level send helpers and payload builders.
// ============================================================

function send(ws, type, payload) {
	if (ws && ws.readyState === ws.OPEN) {
		ws.send(JSON.stringify({ type, payload }));
	}
}

function broadcastAll(room, type, payload) {
	room.players.forEach(p => send(p.ws, type, payload));
}

function broadcastExcept(room, skipIndex, type, payload) {
	room.players.forEach((p, i) => {
		if (i !== skipIndex) send(p.ws, type, payload);
	});
}

// Build the ship-reveal payload included in every GAME_OVER broadcast.
// Each entry has the cell->shipId mapping so clients can render hidden ships.
function buildReveal(room) {
	return room.game.players.map(p => ({
		ships: p.ships,
		cellShipIds: p.cells.map(c => c.shipId), // null = water
	}));
}

function buildReconnectState(room, playerIndex) {
	const game       = room.game;
	const profiles   = room.players.map(p => p.profile ?? null);
	const playerMeta = room.players.map((p, i) => ({
		playerIndex:  i,
		isCpu:        p.isCpu,
		disconnected: p.disconnected,
	}));

	if (!game) {
		return {
			status:      room.status,
			playerIndex,
			hostIndex:   room.hostIndex,
			playerCount: room.players.length,
			settings:    room.settings,
			profiles,
			players:     playerMeta,
		};
	}

	const mine = game.players[playerIndex];

	const isFinished = game.status === 'finished';

	const deriveStatus = gp => gp?.status ?? 'active';

	const opponents = game.players.map((gp, i) => {
		if (i === playerIndex) return null;
		return {
			playerIndex:  i,
			isCpu:        room.players[i].isCpu,
			disconnected: room.players[i].disconnected,
			status:       deriveStatus(gp),
			shipsLeft:    gp.shipsLeft,
			// In a finished game reveal all ships; during play only expose sunk cells.
			ships: isFinished ? gp.ships : undefined,
			cells: gp.cells.map(c => ({
				hit:    c.hit,
				miss:   c.miss,
				sunk:   c.sunk,
				shipId: (isFinished || c.sunk) ? c.shipId : null,
				shotBy: (c.hit || c.miss) ? c.shotBy : undefined,
			})),
		};
	}).filter(Boolean);

	return {
		status:      room.status,
		gameStatus:  game.status,
		playerIndex,
		hostIndex:   room.hostIndex,
		turnIndex:   game.turnIndex,
		winnerIndex: isFinished ? game.winner : undefined,
		settings:    room.settings,
		profiles,
		players:     playerMeta,
		myPlayer: {
			shipsPlaced: mine.shipsPlaced,
			ships:       mine.ships,
			cells:       mine.cells,
			shipsLeft:   mine.shipsLeft,
			status:      deriveStatus(mine),
		},
		opponents,
	};
}

module.exports = { send, broadcastAll, broadcastExcept, buildReveal, buildReconnectState };
