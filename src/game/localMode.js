// ============================================================
// LOCAL ENGINE - strategy implementation for CPU (offline) mode.
// Handles all game logic specific to local play: player/CPU
// setup, CPU turns, and first-turn resolution.
//
// Spreads base mode (shared logic) and adds the five
// interface methods: startGame, confirmPlacement, surrender,
// shoot, exit.
// ============================================================

import { createBase }   from './baseMode.js';
import * as rules       from './rules.js';
import * as board       from './board.js';
import { computerMove } from './ai.js';
import { showToast }    from '../shared/utils.js';
import { navigate }     from '../router.js';
import { getState }     from '../state.js';

const PLAYER_KEYS  = ['p1', 'p2', 'p3', 'p4'];
const PLAYER_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

export function init(ctx) {
	const base = createBase(ctx);

	// ---- Internal helpers ----

	function assignColors() {
		const p1Color = getState().playerColor;
		ctx.players[0].color = p1Color;
		const remaining = ctx.COLOR_POOL.filter(c => c !== p1Color);
		for (let i = 1; i < ctx.players.length; i++) {
			ctx.players[i].color = remaining[(i - 1) % remaining.length];
		}
	}

	function resolveLocalFirstTurn() {
		const ft = ctx.settings.firstTurn || 'random';
		if (ctx.lastWinnerIsHuman == null || ft === 'random') return Math.random() < 0.5;
		if (ft === 'winner') return ctx.lastWinnerIsHuman;
		if (ft === 'loser')  return !ctx.lastWinnerIsHuman;
		return Math.random() < 0.5;
	}

	function runCpuTurns() {
		for (const cpu of ctx.players.slice(1)) {
			if (cpu.status !== 'active') continue;
			const validTargets = ctx.players.filter(p => p !== cpu && p.status === 'active');
			if (validTargets.length === 0) continue;
			const cpuTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
			const aiIndex  = computerMove(cpuTarget, ctx.settings.width, ctx.settings.length, ctx.settings.difficulty);
			const aiResult = rules.applyShot(cpuTarget, aiIndex);

			if (cpuTarget === ctx.players[0]) {
				base.applyShotResult(board.getCells('p1'), cpuTarget, aiIndex, aiResult, false, cpu.color, cpu);
				if (aiResult.gameOver) {
					ctx.players[0].status = 'eliminated';
					ctx.updatePlayerCard(0);
					const aliveCpus = ctx.players.slice(1).filter(p => p.status === 'active');
					if (aliveCpus.length > 1) { simulateCpuMatch(); } else { endGame(false, aliveCpus[0]?.name); }
					return;
				}
			} else {
				cpuTarget.shotColors[aiIndex] = cpu.color;
				if (cpuTarget === ctx.players[ctx.targetIndex]) base.showTargetGrid(ctx.targetIndex);
				if (aiResult.gameOver) {
					showToast(`${cpuTarget.name} was eliminated!`);
					cpuTarget.status = 'eliminated';
					ctx.updatePlayerCard(ctx.players.indexOf(cpuTarget));
					const aliveEnemies = ctx.players.slice(1).filter(p => p.status === 'active');
					if (aliveEnemies.length === 0) { endGame(true); return; }
					if (ctx.players[ctx.targetIndex].status !== 'active') base.moveTarget(1);
					base.updateArrows();
				}
			}
		}
	}

	// Fast-forwards the remaining CPU vs CPU battle when the human is eliminated
	// with more than one CPU still alive. Runs up to 10,000 rounds synchronously.
	function simulateCpuMatch() {
		for (let round = 0; round < 10000; round++) {
			const alive = ctx.players.slice(1).filter(p => p.status === 'active');
			if (alive.length <= 1) break;
			for (const cpu of alive) {
				const targets = ctx.players.filter(p => p !== cpu && p.status === 'active');
				if (!targets.length) continue;
				const target = targets[Math.floor(Math.random() * targets.length)];
				const aiIndex  = computerMove(target, ctx.settings.width, ctx.settings.length, ctx.settings.difficulty);
				const result = rules.applyShot(target, aiIndex);
				target.shotColors[aiIndex] = cpu.color;
				if (result.gameOver) {
					target.status = 'eliminated';
					ctx.updatePlayerCard(ctx.players.indexOf(target));
					showToast(`${target.name} was eliminated!`, "default", 2500);
				}
			}
		}
		const winner = ctx.players.slice(1).find(p => p.status === 'active');
		endGame(false, winner?.name);
	}

	// ---- Mode interface ----

	function startGame() {
		// Snapshot pending settings into active settings before building game state.
		Object.assign(ctx.settings, ctx.pendingSettings, { ships: { ...ctx.pendingSettings.ships } });
		ctx.btnNewGame.classList.add('off');
		ctx.targetGridEl.classList.add('off');
		ctx.targetNavEl.classList.add('hide');
		ctx.btnPrevTarget.classList.add('hide');
		ctx.btnNextTarget.classList.add('hide');

		const { width, length, ships, playerCount } = ctx.settings;
		const total = rules.shipTotal(ships);
		ctx.players = Array.from({ length: playerCount }, (_, i) => {
			const p = rules.createPlayer(total);
			p.cells  = rules.initCells(width, length);
			p.key    = PLAYER_KEYS[i];
			p.name   = i === 0 ? (getState().playerName || 'Player 1') : PLAYER_NAMES[i];
			p.avatar = i === 0 ? (getState().playerAvatar || null) : ctx.CPU_IMAGES[(i - 1) % ctx.CPU_IMAGES.length];
			p.isCpu  = i > 0;
			return p;
		});
		assignColors();
		ctx.targetIndex = 1;

		board.buildGrid(ctx.targetGridEl, { playerKey: 'p2', myGrid: false, width, length });
		base.buildOceanGrid();
		base.resetPlacementState();
		base.syncSelectors();
		base.togglePlacementBtns();
		ctx.renderPlayerCards();
	}

	function confirmPlacement() {
		if (base.getShipsPlaced() !== rules.shipTotal(ctx.settings.ships)) return;
		base.togglePlacementBtns();
		board.getCells('p1').forEach(td => td.removeAttribute('draggable'));

		const { width, length, ships } = ctx.settings;
		for (let i = 1; i < ctx.players.length; i++) {
			ctx.players[i].cells = rules.initCells(width, length);
			ctx.players[i].ships = [];
			const cpuPlaced = base.randomlyPlaceShips(ships, ctx.players[i].cells);
			if (!cpuPlaced) { showToast('Grid too small for the chosen ships.', 'danger'); return; }
			cpuPlaced.forEach(({ ship }) => { ctx.players[i].ships[ship.id] = ship; });
		}

		base.showTargetGrid(ctx.targetIndex);
		ctx.targetGridEl.classList.remove('off');
		ctx.btnSurrender.classList.remove('off');
		base.updateArrows();

		const humanFirst = resolveLocalFirstTurn();
		showToast(humanFirst ? 'You go first!' : 'CPU goes first!', 'default', 2500);
		base.setGamePhase('playing');
		if (!humanFirst) runCpuTurns();
	}

	function surrender() {
		ctx.players[0].status = 'surrendered';
		ctx.updatePlayerCard(0);
		showToast('You surrendered.', 'default', 3000);
		const aliveCpus = ctx.players.slice(1).filter(p => p.status === 'active');
		if (aliveCpus.length > 1) {
			simulateCpuMatch();
		} else {
			endGame(false, aliveCpus[0]?.name);
		}
	}

	function shoot(index) {
		if (!ctx.playflag) return;
		const target = ctx.players[ctx.targetIndex];
		if (!rules.isValidShot(target, index)) return;
		const result = rules.applyShot(target, index);
		base.applyShotResult(board.getCells(target.key), target, index, result, true, ctx.players[0].color);
		ctx.stats.addShot();
		if (result.hit) ctx.stats.addHit();
		if (result.gameOver) {
			target.status = 'eliminated';
			ctx.updatePlayerCard(ctx.targetIndex);
			const aliveEnemies = ctx.players.slice(1).filter(p => p.status === 'active');
			if (aliveEnemies.length === 0) { endGame(true); return; }
			base.moveTarget(1);
			base.updateArrows();
		}
		runCpuTurns();
	}

	function exit() {
		if (base.exitConfirmation()) navigate('lobby');
	}

	// Build lightweight player stubs for pregame display.
	// Replaced with real players when startGame() runs.
	function buildStubs() {
		const { playerCount } = ctx.settings;
		const p1Color = getState().playerColor;
		const remaining = ctx.COLOR_POOL.filter(c => c !== p1Color);
		ctx.players = Array.from({ length: playerCount }, (_, i) => {
			const p = rules.createPlayer(0);
			p.key   = PLAYER_KEYS[i];
			p.name  = i === 0 ? (getState().playerName || 'Player 1') : PLAYER_NAMES[i];
			p.avatar = i === 0 ? (getState().playerAvatar || null) : ctx.CPU_IMAGES[(i - 1) % ctx.CPU_IMAGES.length];
			p.color = i === 0 ? p1Color : remaining[(i - 1) % remaining.length];
			p.isCpu = i > 0;
			return p;
		});
		ctx.renderPlayerCards();
	}

	buildStubs();

	function endGame(iWon, winnerName = null, reviewIndex = null) {
		ctx.lastWinnerIsHuman = iWon;
		base.finishGame(iWon, winnerName, reviewIndex);
		ctx.btnNewGame.classList.remove('off');
	}

	return {
		...base,
		startGame,
		confirmPlacement,
		surrender,
		shoot,
		exit,
	};
}
