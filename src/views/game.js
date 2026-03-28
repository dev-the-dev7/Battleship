// ============================================================
// GAME VIEW - HTML template + event orchestration.
// Delegates all game logic to:
//   game/baseMode.js   - shared actions (placement, grid, shots)
//   game/localMode.js  - offline mode strategy
//   game/onlineMode.js - online mode strategy
// ============================================================

import { getState }        from '../state.js';
import * as rules          from '../game/rules.js';
import * as board          from '../game/board.js';
import * as placement      from '../game/placement.js';
import * as settingsPanel  from '../game/settingsPanel.js';
import * as network        from '../network.js';
import { createStats }     from '../game/stats.js';
import * as playerCards    from '../game/playerCards.js';
import * as localMode      from '../game/localMode.js';
import * as onlineMode     from '../game/onlineMode.js';
import { COLOR_POOL }      from '../shared/utils.js';

const CPU_IMAGES = ['./assets/glad_bot.png', './assets/hologram.png', './assets/ship_guy.png'];

export function mount(container, mode) {
	container.innerHTML = html();
	init(mode);
}

// ---- HTML template ----

function html() {
	return `
		<header><img src="./assets/title.png" alt="Battleship"></header>
		<div class="row">
			<div class="col-left">
				<h2>Game Stats</h2>
				<p id="wins">Wins: 0</p>
				<p id="losses">Losses: 0</p>
				<p id="win-rate">Win Rate: 0%</p>
				<p id="accuracy">Accuracy: 0%</p>
				<h2>Place Ships</h2>
				<div class="ship-placement-container">
					<div class="ship-container carrier off">
						<div data-id="0"></div><div data-id="1"></div><div data-id="2"></div>
						<div data-id="3"></div><div data-id="4"></div>
					</div>
					<div class="ship-container battleship off">
						<div data-id="0"></div><div data-id="1"></div>
						<div data-id="2"></div><div data-id="3"></div>
					</div>
					<div class="ship-container cruiser off">
						<div data-id="0"></div><div data-id="1"></div><div data-id="2"></div>
					</div>
					<div class="ship-container submarine off">
						<div data-id="0"></div><div data-id="1"></div><div data-id="2"></div>
					</div>
					<div class="ship-container destroyer off">
						<div data-id="0"></div><div data-id="1"></div>
					</div>
				</div>
				<div>
					<button id="btn-random"  class="off">Random</button>
					<button id="btn-rotate"  class="off">Rotate</button>
					<button id="btn-reset"   class="off">Reset</button>
					<button id="btn-confirm" class="off">Confirm</button>
				</div>
			</div>
			<div class="col-mid">
				<div id="target-nav" class="hide">
					<button id="btn-prev-target" class="grid-nav hide">&#8592;</button>
					<span id="target-label" class="target-label"></span>
					<button id="btn-next-target" class="grid-nav hide">&#8594;</button>
				</div>
				<table id="target-grid" class="off"></table>
				<table id="ocean-grid"></table>
			</div>
			<div class="col-right">
				<div id="room-code-display" class="room-code-display hide"></div>
				<div id="player-cards"></div>
				<div class="btn-group">
					<div class="settings"><button id="btn-settings">Settings</button></div>
					<div class="surrender"><button id="btn-surrender" class="off">Surrender</button></div>
					<div class="restart"><button id="btn-new-game">New Game</button></div>
					<div class="exit"><button id="btn-exit">Exit</button></div>
				</div>
			</div>
		</div>
		<div class="settings-overlay hide">
			<div class="settings-modal">
				<div class="settings-header">
					<div class="settings-tabs">
						<button class="settings-tab active" data-tab="difficulty">Player</button>
						<button class="settings-tab" data-tab="grid">Grid</button>
						<button class="settings-tab" data-tab="ships">Ships</button>
					</div>
					<button id="btn-settings-close" class="settings-close">&#10005;</button>
				</div>
				<div class="settings-panel" id="tab-difficulty">
					<div class="settings-item">
						<span>CPU Difficulty</span>
						<select id="difficulty-select">
							<option value="easy">Easy</option>
							<option value="medium" selected>Medium</option>
							<option value="hard">Hard</option>
						</select>
					</div>
					<div class="settings-item">
						<span>Players</span>
						<select id="player-count-select">
							<option value="2" selected>2</option>
							<option value="3">3</option>
							<option value="4">4</option>
						</select>
					</div>
					<div class="settings-item">
						<span>First Turn</span>
						<select id="first-turn-select">
							<option value="random" selected>Random</option>
							<option value="winner">Winner</option>
							<option value="loser">Loser</option>
						</select>
					</div>
			</div>
			<div class="settings-panel hide" id="tab-grid">
					<div class="settings-item">
						<span>Width</span>
						<input type="range" id="col-slider" min="10" max="15" value="10" step="1">
						<p id="col">10</p>
					</div>
					<div class="settings-item">
						<span>Length</span>
						<input type="range" id="row-slider" min="10" max="15" value="10" step="1">
						<p id="row">10</p>
					</div>
				</div>
				<div class="settings-panel hide" id="tab-ships">
					<div class="settings-item">
						<span>Carrier</span>
						<input type="range" id="car-slider" min="0" max="5" value="1" step="1">
						<p id="car">1</p>
					</div>
					<div class="settings-item">
						<span>Battleship</span>
						<input type="range" id="batle-slider" min="0" max="5" value="1" step="1">
						<p id="batle">1</p>
					</div>
					<div class="settings-item">
						<span>Cruiser</span>
						<input type="range" id="cru-slider" min="0" max="5" value="1" step="1">
						<p id="cru">1</p>
					</div>
					<div class="settings-item">
						<span>Submarine</span>
						<input type="range" id="subm-slider" min="0" max="5" value="1" step="1">
						<p id="sub">1</p>
					</div>
					<div class="settings-item">
						<span>Destroyer</span>
						<input type="range" id="des-slider" min="0" max="5" value="1" step="1">
						<p id="des">1</p>
					</div>
				</div>
			</div>
		</div>
		<div id="toast-container"></div>`;
}

// ---- Game initialisation ----

function init(mode) {
	const isOnline = mode === 'online';

	// ---- DOM references ----
	const targetGridEl       = document.getElementById('target-grid');
	const oceanGridEl        = document.getElementById('ocean-grid');
	const targetNavEl        = document.getElementById('target-nav');
	const targetLabelEl      = document.getElementById('target-label');
	const playerCardsEl      = document.getElementById('player-cards');
	const btnPrevTarget      = document.getElementById('btn-prev-target');
	const btnNextTarget      = document.getElementById('btn-next-target');
	const btnNewGame         = document.getElementById('btn-new-game');
	const btnConfirm         = document.getElementById('btn-confirm');
	const btnRandom          = document.getElementById('btn-random');
	const btnRotate          = document.getElementById('btn-rotate');
	const btnReset           = document.getElementById('btn-reset');
	const btnSettings        = document.getElementById('btn-settings');
	const btnSurrender       = document.getElementById('btn-surrender');
	const btnExit            = document.getElementById('btn-exit');
	const settingsScreenEl     = document.querySelector('.settings-overlay');
	const placementContainerEl = document.querySelector('.ship-placement-container');
	const shipSelectorEls      = document.querySelectorAll('.ship-container');

	// ---- Stats panel ----
	const stats = createStats();

	// ---- View-local game settings ----
	// pendingSettings: edited by the settings panel; applied to settings on New Game.
	let pendingSettings = {
		width:       10,
		length:      10,
		ships:       rules.defaultShipConfig(),
		difficulty:  'medium',
		playerCount: 2,
		firstTurn:   'random',
	};
	// settings: active game settings used by all game logic - snapshotted from
	// pendingSettings when startGame() runs so panel changes never affect a live game.
	let settings = { ...pendingSettings, ships: { ...pendingSettings.ships } };

	// ---- Per-game state ----
	let players           = [];
	let targetIndex       = 1;
	let gamePhase         = 'idle';
	let myTurn            = false;
	let lastWinnerIsHuman = null;
	let hostIndex         = isOnline ? (getState().onlineHostIndex ?? 0) : 0;

	let currentTurnServer = null;
	let connectedCount    = isOnline ? Math.max(2, getState().connectedIndices?.length ?? 2) : 2;
	const myPlayerIndex   = isOnline ? (getState().playerIndex ?? 0) : 0;

	// ---- Initial display grids ----
	board.buildGrid(targetGridEl, { playerKey: 'p2', myGrid: false, width: 10, length: 10 });
	board.buildGrid(oceanGridEl,  { playerKey: 'p1', myGrid: true,  width: 10, length: 10 });

	// ---- ctx - shared state interface for all modes ----
	let multiplayerMode;
	const ctx = {
		get players()            { return players; },
		set players(v)           { players = v; },
		get settings()           { return settings; },
		get pendingSettings()    { return pendingSettings; },
		get targetIndex()        { return targetIndex; },
		set targetIndex(v)       { targetIndex = v; },
		get gamePhase()          { return gamePhase; },
		set gamePhase(v)         { gamePhase = v; },
		get playflag()           { return gamePhase === 'playing'; },
		get myTurn()             { return myTurn; },
		set myTurn(v)            { myTurn = v; },
		get lastWinnerIsHuman()  { return lastWinnerIsHuman; },
		set lastWinnerIsHuman(v) { lastWinnerIsHuman = v; },
		get hostIndex()          { return hostIndex; },
		set hostIndex(v)         { hostIndex = v; },

		get currentTurnServer()  { return currentTurnServer; },
		set currentTurnServer(v) { currentTurnServer = v; },
		get connectedCount()     { return connectedCount; },
		set connectedCount(v)    { connectedCount = v; },

		isOnline,
		myPlayerIndex,

		targetNavEl,
		targetGridEl,
		oceanGridEl,
		targetLabelEl,
		playerCardsEl,
		btnPrevTarget,
		btnNextTarget,
		btnNewGame,
		btnConfirm,
		btnRandom,
		btnRotate,
		btnReset,
		btnSettings,
		btnSurrender,
		btnExit,
		settingsScreenEl,
		placementContainerEl,
		shipSelectorEls,

		COLOR_POOL,
		CPU_IMAGES,

		get stats()             { return stats; },
		get renderPlayerCards() { return renderPlayerCards; },
		get updatePlayerCard()  { return updatePlayerCard; },

		// Proxy to mode's shoot action - mode defined below, closure captures it by reference
		shoot: (i) => multiplayerMode?.shoot(i),
	};

	// ---- Player cards ----
	const pcCtx = {
		get players()       { return players; },
		get hostIndex()     { return hostIndex; },
		isOnline,
		get playerCardsEl() { return playerCardsEl; },
	};
	const { renderPlayerCards, updatePlayerCard } = playerCards.init(pcCtx);

	// ---- Initialize game mode ----
	multiplayerMode = isOnline
		? onlineMode.init(network, ctx)
		: localMode.init(ctx);

	// ---- Drag-drop wiring ----
	// initShipSelectors is called once here (not per-game) to avoid duplicate listeners
	placement.initShipSelectors(shipSelectorEls);

	let benchPart = 0;
	shipSelectorEls.forEach(shipEl => {
		shipEl.addEventListener('mousedown', e => {
			benchPart = parseInt(e.target.getAttribute('data-id')) || 0;
		});
		shipEl.addEventListener('dragstart', e => multiplayerMode.onBenchDragStart(e, shipEl, benchPart));
		shipEl.addEventListener('dragend',   () => multiplayerMode.onBenchDragEnd(shipEl));
	});

	oceanGridEl.addEventListener('dragstart', e => multiplayerMode.onOceanDragStart(e));
	oceanGridEl.addEventListener('dragend',   () => multiplayerMode.onOceanDragEnd());

	// ---- Button: New Game ----
	btnNewGame.addEventListener('click', () => {
		if (btnNewGame.classList.contains('off') || ctx.playflag) return;
		multiplayerMode.startGame();
	});

	// ---- Button: Random placement ----
	btnRandom.addEventListener('click', () => {
		if (btnConfirm.classList.contains('off')) return;
		multiplayerMode.handleRandom();
	});

	// ---- Button: Rotate ----
	btnRotate.addEventListener('click', () => {
		if (btnConfirm.classList.contains('off')) return;
		shipSelectorEls.forEach(ship => ship.classList.toggle('vertical'));
		placementContainerEl.classList.toggle('horizontal');
	});

	// ---- Button: Reset ----
	btnReset.addEventListener('click', () => {
		if (btnConfirm.classList.contains('off')) return;
		multiplayerMode.handleReset();
	});

	// ---- Button: Confirm placement ----
	btnConfirm.addEventListener('click', () => {
		if (btnConfirm.classList.contains('off')) return;
		multiplayerMode.confirmPlacement();
	});

	// ---- Target selector ----
	btnPrevTarget.addEventListener('click', () => {
		if (ctx.playflag) {
			multiplayerMode.moveTarget(-1);
		} else {
			const oppIndices = players.reduce((acc, p, i) => { if (p && i !== myPlayerIndex) acc.push(i); return acc; }, []);
			if (oppIndices.length > 1) {
				const pos = oppIndices.indexOf(targetIndex);
				targetIndex = oppIndices[(pos - 1 + oppIndices.length) % oppIndices.length];
				multiplayerMode.showReviewGrid(targetIndex);
			}
		}
	});
	btnNextTarget.addEventListener('click', () => {
		if (ctx.playflag) {
			multiplayerMode.moveTarget(1);
		} else {
			const oppIndices = players.reduce((acc, p, i) => { if (p && i !== myPlayerIndex) acc.push(i); return acc; }, []);
			if (oppIndices.length > 1) {
				const pos = oppIndices.indexOf(targetIndex);
				targetIndex = oppIndices[(pos + 1) % oppIndices.length];
				multiplayerMode.showReviewGrid(targetIndex);
			}
		}
	});

	// ---- Button: Surrender ----
	btnSurrender.addEventListener('click', () => {
		if (btnSurrender.classList.contains('off') || !ctx.playflag) return;
		if (!confirm('Are you sure you want to surrender?')) return;
		multiplayerMode.surrender();
	});

	// ---- Button: Exit ----
	btnExit.addEventListener('click', () => multiplayerMode.exit());

	// ---- Settings ----
	const getMinPlayerCount = isOnline ? () => connectedCount : null;

	btnSettings.addEventListener('click', () => {
		if (!btnSettings.classList.contains('off')) {
			settingsPanel.sync(pendingSettings, getMinPlayerCount);
			settingsScreenEl.classList.remove('hide');
		}
	});

	settingsPanel.init(settingsScreenEl, pendingSettings, {
		shipTotal: rules.shipTotal,
		getMinPlayerCount,
	});
}
