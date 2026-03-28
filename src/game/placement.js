// ============================================================
// PLACEMENT - drag-and-drop ship placement event handling.
// Manages drag state and validates drops.
// The view owns grid cells and ship selectors; this module just
// handles the interaction logic and reports results back.
// ============================================================

let draggedShip  = null;
let selectedPart = 0;   // which segment of the ship the user grabbed

function clearDragOver() {
	document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

// Attach drag events to the ship selector elements (.ship-container divs).
// Call this once per New Game, after the ship selectors are in the DOM.
export function initShipSelectors(shipEls) {
	shipEls.forEach(ship => {
		ship.addEventListener('dragstart', e => { draggedShip = e.target; });
		ship.addEventListener('dragend', () => {
			draggedShip = null;
			clearDragOver();
		});
		// Record which part of the ship was grabbed for correct alignment
		ship.addEventListener('mousedown', e => {
			selectedPart = parseInt(e.target.getAttribute('data-id')) || 0;
		});
	});
}

// allowDrop handler - call preventDefault only when placement mode is active
// and a ship is being dragged. isActive() should return true during placement.
export function makeAllowDrop(isActive) {
	return (e) => {
		if (isActive() && draggedShip) e.preventDefault();
	};
}

// Handle a drop event on a grid cell.
// p1Cells - the current cells[] array for p1 (plain state, not DOM)
// width, length - current grid dimensions
//
// Returns a placement descriptor if the drop is valid:
//   { shipClass, shipLen, alignment, indices, shipEl }
// Returns null if the placement is out-of-bounds or overlapping.
// forceAlign: when set by baseMode.js (grid re-drag), overrides the bench tile's vertical class.
export function handleDrop(e, cells, width, length, forceAlign = null) {
	if (!draggedShip) return null;

	const shipLen    = draggedShip.children.length;
	// Parse the cell index from the prefixed id ('p1-42' -> 42)
	const selectedIndex = parseInt(e.target.id.split('-')[1]);
	const alignment  = forceAlign ?? (draggedShip.classList.contains('vertical') ? 1 : 0);
	const multiplier = (width - 1) * alignment + 1;
	const startPoint = selectedIndex - selectedPart * multiplier;
	const endPoint   = startPoint + (shipLen - 1) * multiplier;

	// Boundary check - horizontal wrap
	if (alignment === 0 && endPoint % width < (shipLen - 1) % width) {
		e.target.classList.remove('drag-over');
		return null;
	}
	// Boundary check - vertical out-of-bounds
	if (alignment === 1 && (endPoint < width * (shipLen - 1) || endPoint > width * length - 1)) {
		e.target.classList.remove('drag-over');
		return null;
	}

	const indices = alignment === 0
		? Array.from({ length: shipLen }, (_, i) => startPoint + i)
		: Array.from({ length: shipLen }, (_, i) => startPoint + i * width);

	// Overlap check
	if (indices.some(i => cells[i].shipId !== null)) {
		e.target.classList.remove('drag-over');
		return null;
	}

	return { shipClass: draggedShip.classList.item(1), shipLen, alignment, indices, shipEl: draggedShip };
}

// Allow game.js to programmatically start a drag from a grid cell.
export function startDrag(el, part) {
	draggedShip  = el;
	selectedPart = part;
}

export function clearDrag() {
	draggedShip = null;
	clearDragOver();
}

export function dragEnter(e) {
	clearDragOver();
	e.target.classList.add('drag-over');
}

export function dragLeave(e) { e.target.classList.remove('drag-over'); }
