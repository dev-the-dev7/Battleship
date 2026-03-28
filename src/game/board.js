// ============================================================
// BOARD - grid building and all cell DOM updates.
// Keeps a registry of td elements per player so callers can
// update cells by plain index without keeping DOM refs themselves.
// ============================================================

// cellRegistry[playerKey] = HTMLTableCellElement[] (one per grid position)
const cellRegistry = {};

// Build a grid <table>. Clears any previous content.
// options:
//   playerKey   string  - used to store/retrieve cells ('p1' | 'p2')
//   myGrid      boolean - true = ocean grid (YOUR FLEET), false = target grid (ENEMY FLEET)
//   width       number  - grid columns
//   length      number  - grid rows
//   dragHandlers object - optional { drop, dragover, dragenter, dragleave } for placement
export function buildGrid(tableEl, options) {
	const { playerKey, myGrid, width, length, dragHandlers } = options;

	tableEl.replaceChildren();
	cellRegistry[playerKey] = [];

	const cap = document.createElement('caption');
	cap.textContent = myGrid ? 'YOUR FLEET' : 'ENEMY FLEET';
	tableEl.appendChild(cap);

	for (let y = -1; y < length; y++) {
		const tr = document.createElement('tr');

		for (let x = -1; x < width; x++) {
			if (y === -1) {
				// Column headings (A, B, C…)
				const th = document.createElement('th');
				if (x !== -1) th.textContent = (x + 10).toString(36).toUpperCase();
				tr.appendChild(th);
			} else if (x === -1) {
				// Row headings (1, 2, 3…)
				const th = document.createElement('th');
				th.textContent = y + 1;
				tr.appendChild(th);
			} else {
				const td = document.createElement('td');
				// Prefix the player key so p1 and p2 cells never share an id
				td.id = `${playerKey}-${y * width + x}`;

				if (dragHandlers) {
					td.addEventListener('drop',      dragHandlers.drop);
					td.addEventListener('dragover',  dragHandlers.dragover);
					td.addEventListener('dragenter', dragHandlers.dragenter);
					td.addEventListener('dragleave', dragHandlers.dragleave);
				}

				cellRegistry[playerKey].push(td);
				tr.appendChild(td);
			}
		}

		tableEl.appendChild(tr);
	}
}

// Return the stored td element array for a player.
export function getCells(playerKey) {
	return cellRegistry[playerKey] ?? [];
}

// ---- Cell state mutators ----

// Mark a cell as hit (adds fire indicator).
// color: optional CSS color string applied directly to the fire element.
export function applyHit(td, color) {
	td.classList.add('hit');
	const fire = document.createElement('div');
	fire.classList.add('fire');
	if (color) {
		fire.style.backgroundColor = color;
		fire.style.boxShadow = `0 0 6px ${color}`;
	}
	td.appendChild(fire);
}

// Mark a cell as a miss.
// color: optional CSS color string applied directly to the bar elements.
export function applyMiss(td, color) {
	td.classList.add('x');
	const barColor = color ?? 'rgba(255, 255, 255, 0.5)';
	[45, -45].forEach(deg => {
		const bar = document.createElement('div');
		bar.className = 'x-bar';
		bar.style.transform = `rotate(${deg}deg)`;
		bar.style.backgroundColor = barColor;
		td.appendChild(bar);
	});
}

// Mark cells as sunk. align: 0=horizontal, 1=vertical.
// Adds end-cap classes so CSS can round the bow and stern.
export function applySunk(tds, align = 0) {
	const last = tds.length - 1;
	tds.forEach((td, i) => {
		td.classList.add('ship', 'sunk');
		td.classList.remove('hit');
		td.querySelectorAll('.fire').forEach(el => el.remove());
		applyShipEnds(td, i, last, align);
	});
}

// Mark an ordered array of tds as ship cells, applying end-cap classes.
// align: 0=horizontal, 1=vertical
export function markShipCells(tds, shipId, align) {
	const last = tds.length - 1;
	tds.forEach((td, i) => {
		td.classList.add('ship');
		td.setAttribute('data-id', shipId);
		applyShipEnds(td, i, last, align);
	});
}

// Add the appropriate bow/stern CSS class to a ship cell.
function applyShipEnds(td, index, last, align) {
	const [start, end] = align === 0 ? ['ship-left', 'ship-right'] : ['ship-top', 'ship-bottom'];
	if (index === 0)    td.classList.add(start);
	if (index === last) td.classList.add(end);
}

// Reveal all hidden ship cells (used when opponent wins).
// width is needed to detect vertical adjacency.
export function revealShips(cells, player, width) {
	player.cells.forEach((cell, i) => {
		if (cell.shipId === null || cell.sunk) return;
		if (!cells[i]) return; // grid was never built for this player (multiplayer)
		cells[i].classList.add('ship');

		const id    = cell.shipId;
		const align = player.ships[id]?.align ?? 0;

		if (align === 0) {
			const hasLeft  = i % width !== 0 && player.cells[i - 1]?.shipId === id;
			const hasRight = (i + 1) % width !== 0 && player.cells[i + 1]?.shipId === id;
			if (!hasLeft)  cells[i].classList.add('ship-left');
			if (!hasRight) cells[i].classList.add('ship-right');
		} else {
			const hasAbove = i >= width && player.cells[i - width]?.shipId === id;
			const hasBelow = player.cells[i + width]?.shipId === id;
			if (!hasAbove) cells[i].classList.add('ship-top');
			if (!hasBelow) cells[i].classList.add('ship-bottom');
		}
	});
}

// Clear all visual state from a player's cells (reset).
export function clearCells(playerKey) {
	getCells(playerKey).forEach(td => {
		td.className = '';
		td.removeAttribute('data-id');
		td.removeAttribute('draggable');
		td.replaceChildren();
	});
}
