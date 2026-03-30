// ============================================================
// BASE ENGINE - shared game logic for local and online modes.
// Owns placement state, grid management, and visual updates.
// Both localMode and onlineMode spread these methods and
// override only the mode-specific ones.
//
// Call createBase(ctx) once; ctx provides live access to the
// shared game state that lives in the game view's closure.
// ============================================================

import * as board     from './board.js';
import * as rules     from './rules.js';
import * as placement from './placement.js';
import { getState }   from '../state.js';
import { showToast }  from '../shared/utils.js';

export function createBase(ctx) {

	// ---- Placement state ----

	let shipsPlaced  = 0;
	let nextShipId   = 0;
	let placedCounts = {};
	let gridDragShipEl = null;
	let gridDragAlign  = null;

	// Allow drops only while placement buttons are visible; btnConfirm goes 'off' after confirm.
	const allowDrop = placement.makeAllowDrop(() => !ctx.btnConfirm.classList.contains('off'));

	function resetPlacementState() {
		shipsPlaced  = 0;
		nextShipId   = 0;
		placedCounts = Object.fromEntries(Object.keys(ctx.settings.ships).map(k => [k, 0]));
	}

	function getShipsPlaced() { return shipsPlaced; }

	// ---- Bench drag handlers ----

	function applyDragImage(e, sourceEl, isVert, part) {
		const img = sourceEl.cloneNode(true);
		img.classList.remove('off');
		img.classList.toggle('vertical', isVert);
		img.style.cssText = 'position:absolute;left:-9999px;top:-9999px;pointer-events:none';
		document.body.appendChild(img);
		const len  = img.children.length || 1;
		const imgW = img.offsetWidth  || 40;
		const imgH = img.offsetHeight || 40;
		const offX = isVert
			? Math.round(imgW / 2)
			: Math.round((imgW / len) * part + (imgW / len) / 2);
		const offY = isVert
			? Math.round((imgH / len) * part + (imgH / len) / 2)
			: Math.round(imgH / 2);
		e.dataTransfer.setDragImage(img, offX, offY);
		setTimeout(() => document.body.removeChild(img), 0);
	}

	function onBenchDragStart(e, shipEl, benchPart) {
		const isVert = shipEl.classList.contains('vertical');
		applyDragImage(e, shipEl, isVert, benchPart);

		const type = shipEl.classList[1];
		if ((placedCounts[type] || 0) + 1 >= (ctx.settings.ships[type] ?? 1)) {
			setTimeout(() => {
				shipEl.classList.add('off');
				shipEl.removeAttribute('draggable');
			}, 0);
		}
	}

	function onBenchDragEnd(shipEl) {
		const type = shipEl.classList[1];
		if ((placedCounts[type] || 0) < (ctx.settings.ships[type] ?? 1)) {
			shipEl.classList.remove('off');
			shipEl.setAttribute('draggable', 'true');
		}
	}

	// ---- Ocean grid drag handlers ----

	function onOceanDragStart(e) {
		if (ctx.btnReset.classList.contains('off')) return;
		const td = e.target.closest('td');
		if (!td) return;
		const rawId = td.getAttribute('data-id');
		if (rawId === null) return;
		const shipId = parseInt(rawId);
		const ship   = ctx.players[ctx.myPlayerIndex].ships[shipId];
		if (!ship) return;

		const cellIndex   = parseInt(td.id.split('-')[1]);
		const shipIndices = [];
		ctx.players[ctx.myPlayerIndex].cells.forEach((cell, i) => { if (cell.shipId === shipId) shipIndices.push(i); });
		shipIndices.sort((a, b) => a - b);
		const part = Math.max(0, shipIndices.indexOf(cellIndex));

		const selectorEl = document.querySelector(`.ship-container.${ship.type}`);
		if (!selectorEl) return;

		gridDragAlign = ship.align;
		liftPlacedShip(shipId, false);
		gridDragShipEl = selectorEl;
		placement.startDrag(selectorEl, part);

		applyDragImage(e, selectorEl, gridDragAlign === 1, part);
	}

	function onOceanDragEnd() {
		if (gridDragShipEl) {
			gridDragShipEl.classList.remove('off');
			gridDragShipEl.setAttribute('draggable', 'true');
			gridDragShipEl = null;
		}
		gridDragAlign = null;
		placement.clearDrag();
	}

	// ---- Drop and lift ----

	function handleDrop(e) {
		const result = placement.handleDrop(
			e, ctx.players[ctx.myPlayerIndex].cells, ctx.settings.width, ctx.settings.length, gridDragAlign
		);
		if (!result) return;
		const { shipClass, shipLen, alignment, indices, shipEl } = result;
		const ship = rules.createShip(nextShipId, shipClass, shipLen, alignment);
		ctx.players[ctx.myPlayerIndex].ships[nextShipId] = ship;
		rules.placeShip(ctx.players[ctx.myPlayerIndex].cells, ship, indices);
		board.markShipCells(indices.map(i => board.getCells('p1')[i]), ship.id, ship.align);
		indices.forEach(i => board.getCells('p1')[i].setAttribute('draggable', 'true'));
		nextShipId++;
		shipsPlaced++;
		placedCounts[shipClass]++;
		if (placedCounts[shipClass] >= (ctx.settings.ships[shipClass] ?? 1)) {
			shipEl.removeAttribute('draggable');
			shipEl.classList.add('off');
		}
		gridDragShipEl = null;
	}

	function liftPlacedShip(shipId, enableSelector = true) {
		const ship = ctx.players[ctx.myPlayerIndex].ships[shipId];
		if (!ship) return;
		const domCells = board.getCells('p1');
		ctx.players[ctx.myPlayerIndex].cells.forEach((cell, i) => {
			if (cell.shipId !== shipId) return;
			cell.shipId = null;
			domCells[i].className = '';
			domCells[i].removeAttribute('data-id');
			domCells[i].removeAttribute('draggable');
		});
		ctx.players[ctx.myPlayerIndex].ships[shipId] = null;
		shipsPlaced--;
		placedCounts[ship.type]--;
		if (enableSelector) {
			const selectorEl = document.querySelector(`.ship-container.${ship.type}`);
			if (selectorEl) {
				selectorEl.classList.remove('off');
				selectorEl.setAttribute('draggable', 'true');
			}
		}
	}

	function buildOceanGrid() {
		board.buildGrid(ctx.oceanGridEl, {
			playerKey: 'p1',
			myGrid:    true,
			width:     ctx.settings.width,
			length:    ctx.settings.length,
			dragHandlers: {
				drop:      handleDrop,
				dragover:  allowDrop,
				dragenter: placement.dragEnter,
				dragleave: placement.dragLeave,
			},
		});
	}

	// ---- Placement utilities ----

	function togglePlacementBtns() {
		[ctx.btnConfirm, ctx.btnRandom, ctx.btnRotate, ctx.btnReset].forEach(b => b.classList.toggle('off'));
	}

	function syncSelectors() {
		ctx.shipSelectorEls.forEach(ship => {
			const type  = ship.classList[1];
			const count = ctx.settings.ships[type] ?? 0;
			if (count === 0) {
				ship.classList.add('off');
				ship.removeAttribute('draggable');
			} else {
				ship.classList.remove('off');
				ship.setAttribute('draggable', 'true');
			}
		});
	}

	function randomlyPlaceShips(shipConfig, cells) {
		const { width, length } = ctx.settings;
		const MAX_RETRIES = 20;
		for (let retry = 0; retry < MAX_RETRIES; retry++) {
			cells.forEach(c => { c.shipId = null; });
			const ships  = rules.createShips(shipConfig);
			const placed = [];
			let failed   = false;
			for (const ship of ships) {
				const idx = rules.randomPlacementIndices(cells, width, length, ship);
				if (!idx) { failed = true; break; }
				rules.placeShip(cells, ship, idx);
				placed.push({ ship, idx });
			}
			if (!failed) return placed;
		}
		return null;
	}

	function handleRandom() {
		const { width, length, ships } = ctx.settings;
		const total       = rules.shipTotal(ships);
		const savedColor  = ctx.players[ctx.myPlayerIndex]?.color  || getState().playerColor;
		const savedAvatar = ctx.players[ctx.myPlayerIndex]?.avatar ?? getState().playerAvatar ?? null;
		ctx.players[ctx.myPlayerIndex] = rules.createPlayer(total);
		Object.assign(ctx.players[ctx.myPlayerIndex], {
			cells:  rules.initCells(width, length),
			key:    'p1',
			name:   getState().playerName || 'Player 1',
			color:  savedColor,
			avatar: savedAvatar,
		});
		board.clearCells('p1');
		resetPlacementState();
		const placed = randomlyPlaceShips(ships, ctx.players[ctx.myPlayerIndex].cells);
		if (!placed) {
			showToast('Grid too small for chosen ships. Reduce ship counts or increase grid size.', 'danger');
			return;
		}
		placed.forEach(({ ship, idx }) => {
			ctx.players[ctx.myPlayerIndex].ships[ship.id] = ship;
			board.markShipCells(idx.map(i => board.getCells('p1')[i]), ship.id, ship.align);
			idx.forEach(i => board.getCells('p1')[i].setAttribute('draggable', 'true'));
		});
		shipsPlaced = total;
		nextShipId  = total;
		placed.forEach(({ ship }) => { placedCounts[ship.type]++; });
		ctx.shipSelectorEls.forEach(ship => {
			ship.removeAttribute('draggable');
			ship.classList.add('off');
		});
	}

	function handleReset() {
		const { width, length } = ctx.settings;
		ctx.players[ctx.myPlayerIndex].cells = rules.initCells(width, length);
		ctx.players[ctx.myPlayerIndex].ships = [];
		board.clearCells('p1');
		resetPlacementState();
		syncSelectors();
	}

	// ---- Target grid ----

	function inferAlign(indices) {
		if (!indices || indices.length < 2) return 0;
		return (indices[1] - indices[0] === 1) ? 0 : 1;
	}

	function reapplyShots(player, cells) {
		const groups = {};
		player.cells.forEach((cell, i) => {
			if (cell.sunk) {
				(groups[cell.shipId] ??= []).push(i);
			} else {
				const color = player.shotColors[i];
				if (cell.hit)       board.applyHit(cells[i], color);
				else if (cell.miss) board.applyMiss(cells[i], color);
			}
		});
		Object.entries(groups).forEach(([id, indices]) => {
			const align = player.ships[id]?.align ?? inferAlign(indices);
			board.applySunk(indices.map(i => cells[i]), align);
		});
	}

	function showTargetGrid(idx) {
		const { width, length } = ctx.settings;
		const target = ctx.players[idx];
		board.buildGrid(ctx.targetGridEl, { playerKey: target.key, myGrid: false, width, length });
		const cells = board.getCells(target.key);
		reapplyShots(target, cells);
		cells.forEach((td, i) => td.addEventListener('click', () => ctx.shoot(i)));
		ctx.targetLabelEl.textContent = target.status !== 'active'
			? `${target.name}'s FLEET (eliminated)`
			: `${target.name}'s FLEET`;
	}

	function moveTarget(direction) {
		const opponents = ctx.players.reduce((acc, _, i) => {
			if (i !== ctx.myPlayerIndex) acc.push(i);
			return acc;
		}, []);
		let pos = opponents.indexOf(ctx.targetIndex);
		let attempts = 0;
		do {
			pos = (pos + direction + opponents.length) % opponents.length;
			ctx.targetIndex = opponents[pos];
			attempts++;
		} while (ctx.players[ctx.targetIndex].status !== 'active' && attempts < opponents.length);
		if (ctx.players[ctx.targetIndex].status === 'active') showTargetGrid(ctx.targetIndex);
		updateArrows();
	}

	function updateArrows() {
		const opponents = ctx.players.filter((p, i) => p && i !== ctx.myPlayerIndex);
		const hideNav    = opponents.length <= 1;
		const hideArrows = opponents.filter(p => p.status === 'active').length <= 1;
		ctx.targetNavEl.classList.toggle('hide', hideNav);
		ctx.btnPrevTarget.classList.toggle('hide', hideArrows);
		ctx.btnNextTarget.classList.toggle('hide', hideArrows);
	}

	function showReviewGrid(idx) {
		const { width, length } = ctx.settings;
		const p = ctx.players[idx];
		ctx.targetGridEl.classList.remove('waiting');
		board.buildGrid(ctx.targetGridEl, { playerKey: p.key, myGrid: false, width, length });
		const cells = board.getCells(p.key);
		reapplyShots(p, cells);
		board.revealShips(cells, p, width);
		const isMe = idx === ctx.myPlayerIndex;
		ctx.targetLabelEl.textContent = isMe ? 'YOUR FLEET' : `${p.name}'s FLEET`;
	}

	// ---- Ocean grid ----

	function applyShotResult(cells, target, index, result, humanShooting, shooterColor, shooter) {
		target.shotColors[index] = shooterColor;
		const td = cells[index];
		if (result.hit) {
			board.applyHit(td, shooterColor);
			if (result.sunk) {
				const align = target.ships[result.shipId]?.align ?? inferAlign(result.sunkIndices);
				board.applySunk(result.sunkIndices.map(i => cells[i]), align);
				if (humanShooting || target === ctx.players[ctx.myPlayerIndex]) {
					let sunkMsg;
					if (humanShooting) {
						sunkMsg = `You sank ${target.name}'s ${result.shipType}!`;
					} else if (shooter) {
						sunkMsg = `${shooter.name} sank your ${result.shipType}!`;
					} else {
						sunkMsg = `Your ${result.shipType} was sunk!`;
					}
					showToast(sunkMsg);
				}
			}
		} else {
			board.applyMiss(td, shooterColor);
		}
	}

	// ---- Other ----

	function setGamePhase(phase) { ctx.gamePhase = phase; }

	function finishGame(iWon, winnerName = null, reviewIndex = null) {
		if (ctx.gamePhase !== 'playing') return;
		setGamePhase('idle');

		if (iWon) {
			ctx.stats.addWin();
			showToast('You win!', 'success', 6000);
		} else {
			ctx.stats.addLoss();
			showToast(winnerName ? `${winnerName} wins!` : 'You lose!', 'danger', 6000);
		}

		const startIndex = (reviewIndex != null && reviewIndex >= 0 && reviewIndex < ctx.players.length)
			? reviewIndex : 1;
		ctx.targetIndex = startIndex;
		showReviewGrid(startIndex);
		ctx.targetGridEl.classList.add('off');
		if (ctx.players.length > 2) {
			ctx.targetNavEl.classList.remove('hide');
			ctx.btnPrevTarget.classList.remove('hide');
			ctx.btnNextTarget.classList.remove('hide');
		}
		ctx.btnSurrender.classList.add('off');
	}

	function exitConfirmation() {
		return confirm('Are you sure you want to return to the lobby?');
	}

	return {
		buildOceanGrid,
		onBenchDragStart,
		onBenchDragEnd,
		onOceanDragStart,
		onOceanDragEnd,
		togglePlacementBtns,
		syncSelectors,
		randomlyPlaceShips,
		resetPlacementState,
		getShipsPlaced,
		handleRandom,
		handleReset,
		inferAlign,
		showTargetGrid,
		moveTarget,
		updateArrows,
		showReviewGrid,
		applyShotResult,
		finishGame,
		exitConfirmation,
		setGamePhase,
		get gamePhase() { return ctx.gamePhase; },
	};
}
