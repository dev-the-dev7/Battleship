// ============================================================
// SERVER AI - CPU player logic executed entirely on the server.
// ============================================================

const { SHIP_LENS } = require('../utils/validate');

// ---- Ship placement ----

// Generate a valid ships array for the given ships config object.
// Returns ships ready to pass directly to gameEngine.placeShips().
function cpuPlaceShips(shipsConfig, width, length) {
	const occupied = new Set();
	const ships    = [];
	let shipId     = 0;

	for (const [type, count] of Object.entries(shipsConfig)) {
		const len = SHIP_LENS[type];
		for (let c = 0; c < count; c++) {
			const result = randomPlacement(len, width, length, occupied);
			if (!result) return null;
			result.indices.forEach(i => occupied.add(i));
			ships.push({ id: shipId++, type, align: result.align, indices: result.indices });
		}
	}

	return ships;
}

function randomPlacement(len, width, length, occupied) {
	for (let attempt = 0; attempt < 1000; attempt++) {
		const horizontal = Math.random() < 0.5;
		let indices, align;

		if (horizontal) {
			const row = Math.floor(Math.random() * length);
			const col = Math.floor(Math.random() * (width - len + 1));
			indices   = Array.from({ length: len }, (_, i) => row * width + col + i);
			align     = 0;
		} else {
			const row = Math.floor(Math.random() * (length - len + 1));
			const col = Math.floor(Math.random() * width);
			indices   = Array.from({ length: len }, (_, i) => (row + i) * width + col);
			align     = 1;
		}

		if (indices.every(i => !occupied.has(i))) return { indices, align };
	}

	return null;
}

// ---- Shot selection ----

// easy   - pure random
// medium - random hunt + hit-following
// hard   - coverage-scored hunt + hit-following
function cpuPickShot(targetPlayer, width, length, difficulty = 'medium') {
	if (difficulty === 'easy') return huntRandom(targetPlayer.cells);

	const followIndex = followHits(targetPlayer.cells, width, length);
	if (followIndex !== null) return followIndex;

	if (difficulty === 'hard') return huntSpaced(targetPlayer, width, length);
	return huntRandom(targetPlayer.cells);
}

function huntRandom(cells) {
	const available = [];
	for (let i = 0; i < cells.length; i++) {
		if (!cells[i].hit && !cells[i].miss) available.push(i);
	}
	if (available.length === 0) return null;
	return available[Math.floor(Math.random() * available.length)];
}

// Scores each parity cell by how many valid ship placements pass through it.
// Picks the highest-scoring cell to maximise coverage.
function huntSpaced(targetPlayer, width, length) {
	const cells  = targetPlayer.cells;
	const alive  = targetPlayer.ships.filter(s => !s.sunk);
	const minLen = alive.length > 0 ? Math.min(...alive.map(s => s.len)) : 1;

	let bestParityScore = 0;
	let bestAnyScore    = 0;
	const bestParity    = [];
	const bestAny       = [];

	for (let i = 0; i < cells.length; i++) {
		if (cells[i].hit || cells[i].miss) continue;

		const score = countPlacements(cells, width, length, i, minLen);
		if (score === 0) continue;

		if (score > bestAnyScore) {
			bestAnyScore = score;
			bestAny.length = 0;
			bestAny.push(i);
		} else if (score === bestAnyScore) {
			bestAny.push(i);
		}

		const x = i % width;
		const y = Math.floor(i / width);
		if ((x + y) % minLen === 0) {
			if (score > bestParityScore) {
				bestParityScore = score;
				bestParity.length = 0;
				bestParity.push(i);
			} else if (score === bestParityScore) {
				bestParity.push(i);
			}
		}
	}

	const pool = bestParity.length > 0 ? bestParity : bestAny;
	if (pool.length === 0) return huntRandom(cells);
	return pool[Math.floor(Math.random() * pool.length)];
}

function countPlacements(cells, width, length, i, shipLen) {
	const x = i % width;
	const y = Math.floor(i / width);
	let count = 0;

	const hStartX = Math.max(0, x - shipLen + 1);
	const hEndX   = Math.min(width - shipLen, x);
	for (let startX = hStartX; startX <= hEndX; startX++) {
		let fits = true;
		for (let k = 0; k < shipLen; k++) {
			const c = cells[y * width + startX + k];
			if (c.hit || c.miss) { fits = false; break; }
		}
		if (fits) count++;
	}

	const vStartY = Math.max(0, y - shipLen + 1);
	const vEndY   = Math.min(length - shipLen, y);
	for (let startY = vStartY; startY <= vEndY; startY++) {
		let fits = true;
		for (let k = 0; k < shipLen; k++) {
			const c = cells[(startY + k) * width + x];
			if (c.hit || c.miss) { fits = false; break; }
		}
		if (fits) count++;
	}

	return count;
}

// Hit-following: prefer cells that extend a confirmed run of two hits.
// Falls back to any empty neighbour of an unsunk hit.
function followHits(cells, width, length) {
	const aligned = [];
	const adjacent = [];

	cells.forEach((cell, i) => {
		if (!cell.hit || cell.sunk) return;

		const up = i >= width;
		const dn = i < width * (length - 1);
		const lt = i % width !== 0;
		const rt = i % width !== (width - 1);

		const isEmpty = (idx) => !cells[idx].hit && !cells[idx].miss;

		const eup = up && isEmpty(i - width);
		const edn = dn && isEmpty(i + width);
		const elt = lt && isEmpty(i - 1);
		const ert = rt && isEmpty(i + 1);

		const hup = up && cells[i - width].hit && !cells[i - width].sunk;
		const hdn = dn && cells[i + width].hit && !cells[i + width].sunk;
		const hlt = lt && cells[i - 1].hit     && !cells[i - 1].sunk;
		const hrt = rt && cells[i + 1].hit     && !cells[i + 1].sunk;

		if (elt && hrt) aligned.push(i - 1);
		if (ert && hlt) aligned.push(i + 1);
		if (eup && hdn) aligned.push(i - width);
		if (edn && hup) aligned.push(i + width);

		if (elt) adjacent.push(i - 1);
		if (ert) adjacent.push(i + 1);
		if (eup) adjacent.push(i - width);
		if (edn) adjacent.push(i + width);
	});

	if (aligned.length > 0) return aligned[Math.floor(Math.random() * aligned.length)];
	if (adjacent.length > 0) return adjacent[Math.floor(Math.random() * adjacent.length)];
	return null;
}

// Pick which player the CPU will shoot at this turn.
// 1v1: always the one opponent.
// FFA: random non-eliminated, non-self player.
function cpuPickTarget(game, cpuIndex) {
	if (game.mode === '1v1' && game.players.length === 2) return 1 - cpuIndex;

	const eligible = game.players.reduce((acc, p, i) => {
		if (i !== cpuIndex && p.status === 'active') acc.push(i);
		return acc;
	}, []);

	if (eligible.length === 0) return null;
	return eligible[Math.floor(Math.random() * eligible.length)];
}

module.exports = { cpuPlaceShips, cpuPickShot, cpuPickTarget };
