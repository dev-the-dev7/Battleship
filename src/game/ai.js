// ============================================================
// AI - computer opponent targeting logic.
// Takes plain state, returns an empty cell target index.
//
// easy   - pure random
// medium - random hunt + hit-following
// hard   - coverage-scored hunt + hit-following
// ============================================================

export function computerMove(p1, width, length, difficulty = 'medium') {
	if (difficulty === 'easy') return huntRandom(p1.cells, width, length);

	const followIndex = followHits(p1.cells, width);
	if (followIndex !== null) return followIndex;

	if (difficulty === 'hard') return huntSpaced(p1, width, length);
	return huntRandom(p1.cells, width, length);
}

// ---- Hunt strategies ----

function huntRandom(cells, width, length) {
	let index;
	do {
		index = Math.floor(Math.random() * width * length);
	} while (!isEmpty(cells, index));
	return index;
}

// Scores each coverage cell by how many valid placements of the smallest alive
// ship pass through it. Picks the highest-scoring cell to maximise coverage.
// Falls back to the best non-coverage cell if the coverage grid is exhausted.
// Coverage grid: cells where (x + y) % minLen === 0 form a diagonal stride
// pattern that guarantees any ship of length minLen overlaps at least one cell.
function huntSpaced(p1, width, length) {
	const cells  = p1.cells;
	const alive  = p1.ships.filter(s => s && !s.sunk);
	const minLen = alive.length > 0 ? Math.min(...alive.map(s => s.originalLen)) : 1;

	const coverage = { score: 0, cells: [] };
	const fallback  = { score: 0, cells: [] };

	for (let i = 0; i < cells.length; i++) {
		if (!isEmpty(cells, i)) continue;
		const score = countPlacements(cells, width, length, i, minLen);
		if (score === 0) continue;
		updateBest(fallback, i, score);
		const x = i % width, y = Math.floor(i / width);
		if ((x + y) % minLen === 0) updateBest(coverage, i, score);
	}

	const pool = coverage.cells.length > 0 ? coverage.cells : fallback.cells;
	return pool[Math.floor(Math.random() * pool.length)];
}

function updateBest(best, i, score) {
	if (score > best.score) {
		best.score = score;
		best.cells = [i];
	} else if (score === best.score) {
		best.cells.push(i);
	}
}

// Returns the number of valid placements of a ship of shipLen through cell i.
function countPlacements(cells, width, length, i, shipLen) {
	const x = i % width;
	const y = Math.floor(i / width);

	const hStart = y * width + Math.max(0, x - shipLen + 1);
	const hEnd   = y * width + Math.min(width - shipLen, x);
	const vStart = Math.max(0, y - shipLen + 1) * width + x;
	const vEnd   = Math.min(length - shipLen, y) * width + x;

	return countFits(cells, hStart, hEnd, 1, shipLen)
	     + countFits(cells, vStart, vEnd, width, shipLen);
}

function countFits(cells, start, end, step, shipLen) {
	let count = 0;
	for (let s = start; s <= end; s += step) {
		let fits = true;
		for (let k = 0; k < shipLen; k++) {
			if (!isEmpty(cells, s + k * step)) {
				fits = false;
				break;
			}
		}
		if (fits) count++;
	}
	return count;
}

// ---- Hit following ----

// Prefers cells that extend a known run of two hits (direction confirmed).
// Falls back to any empty neighbour of a hit cell. Picks randomly from all
// equally valid candidates to avoid directional bias.
function followHits(cells, width) {
	const aligned = new Set();
	const adjacent = new Set();

	cells.forEach((cell, i) => {
		if (!cell.hit || cell.sunk) return;

		const lt = i % width !== 0;
		const rt = i % width !== (width - 1);

		const upIdx = i - width;
		const dnIdx = i + width;
		const ltIdx = i - 1;
		const rtIdx = i + 1;

		const eup = isEmpty(cells, upIdx);
		const edn = isEmpty(cells, dnIdx);
		const elt = lt && isEmpty(cells, ltIdx);
		const ert = rt && isEmpty(cells, rtIdx);

		const hup = isHitUnsunk(cells, upIdx);
		const hdn = isHitUnsunk(cells, dnIdx);
		const hlt = lt && isHitUnsunk(cells, ltIdx);
		const hrt = rt && isHitUnsunk(cells, rtIdx);

		if (eup && hdn) aligned.add(upIdx);
		if (edn && hup) aligned.add(dnIdx);
		if (elt && hrt) aligned.add(ltIdx);
		if (ert && hlt) aligned.add(rtIdx);

		if (eup) adjacent.add(upIdx);
		if (edn) adjacent.add(dnIdx);
		if (elt) adjacent.add(ltIdx);
		if (ert) adjacent.add(rtIdx);
	});

	const pick = set => { const a = [...set]; return a[Math.floor(Math.random() * a.length)]; };
	if (aligned.size > 0) return pick(aligned);
	if (adjacent.size > 0) return pick(adjacent);
	return null;
}

function isEmpty(cells, i) {
	const cell = cells[i];
	return cell !== undefined && !cell.hit && !cell.miss && !cell.sunk;
}

function isHitUnsunk(cells, i) {
	const cell = cells[i];
	return !!cell && cell.hit && !cell.sunk;
}
