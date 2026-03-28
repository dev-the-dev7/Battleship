// ============================================================
// ONLINE ENGINE - strategy implementation for network mode.
// Handles all server events and online-specific game actions.
//
// Spreads base mode (shared logic) and adds the five
// interface methods: startGame, confirmPlacement, surrender,
// shoot, exit.
// ============================================================

import { createBase }         from './baseMode.js';
import * as rules             from './rules.js';
import * as board             from './board.js';
import { getState, setState } from '../state.js';
import { showToast, afterPaint } from '../shared/utils.js';
import { navigate }           from '../router.js';

export function init(network, ctx) {
	const base = createBase(ctx);

	// ---- Host button sync ----

	function syncHostButtons() {
		const isHost = ctx.myPlayerIndex === ctx.hostIndex;
		ctx.btnNewGame.classList.toggle('off',  !isHost || base.gamePhase !== 'idle');
		ctx.btnSettings.classList.toggle('off', !isHost);
	}

	// ---- Turn management ----

	function setMyTurn(val, nextServerIndex) {
		ctx.myTurn = val;
		ctx.targetGridEl.classList.toggle('waiting', !val);
		const oldKey = ctx.players[ctx.currentTurnServer]?.key;
		if (oldKey) document.getElementById(`card-${oldKey}`)?.classList.remove('active-turn');
		if (nextServerIndex != null) ctx.currentTurnServer = nextServerIndex;
		const key = ctx.players[ctx.currentTurnServer]?.key;
		if (key) document.getElementById(`card-${key}`)?.classList.add('active-turn');
	}

	// ---- Online placement initialisation ----

	// Build ctx.players in server-index order and reset the placement UI for a new round.
	function startOnlinePlacement(serverSettings) {
		const { ships = {}, width = 10, length = 10 } = serverSettings;
		const playerCount = serverSettings.playerCount || getState().onlinePlayerCount || 2;
		const total = rules.shipTotal(ships);
		ctx.settings.width       = width;
		ctx.settings.length      = length;
		ctx.settings.ships       = ships;
		ctx.settings.playerCount = playerCount;
		if (serverSettings.difficulty) ctx.settings.difficulty = serverSettings.difficulty;
		if (serverSettings.firstTurn)  ctx.settings.firstTurn  = serverSettings.firstTurn;
		// Sync pending so the panel reflects the actual running game settings.
		ctx.pendingSettings.width       = width;
		ctx.pendingSettings.length      = length;
		ctx.pendingSettings.ships       = { ...ships };
		ctx.pendingSettings.playerCount = playerCount;
		if (serverSettings.difficulty) ctx.pendingSettings.difficulty = serverSettings.difficulty;
		if (serverSettings.firstTurn)  ctx.pendingSettings.firstTurn  = serverSettings.firstTurn;

		const oppKeys = ['p2', 'p3', 'p4'];
		const onlineProfiles = serverSettings.profiles || getState().onlineProfiles || [];
		const { playerName, playerAvatar, playerColor } = getState();
		const sessionColor = onlineProfiles[ctx.myPlayerIndex]?.color || playerColor;

		const takenColors = new Set(sessionColor ? [sessionColor] : []);
		const pickColor = () => {
			const c = ctx.COLOR_POOL.find(c => !takenColors.has(c)) ?? ctx.COLOR_POOL[0];
			takenColors.add(c);
			return c;
		};

		// Build ctx.players in server index order: ctx.players[i] = server player i.
		ctx.players = new Array(playerCount);
		ctx.players[ctx.myPlayerIndex] = Object.assign(rules.createPlayer(total), {
			cells:  rules.initCells(width, length),
			key:    'p1',
			name:   (!playerName || /^Player \d+$/.test(playerName)) ? `Player ${ctx.myPlayerIndex + 1}` : playerName,
			color:  sessionColor,
			avatar: playerAvatar || null,
		});
		let oppKeyIndex = 0;
		for (let serverIndex = 0; serverIndex < playerCount; serverIndex++) {
			if (serverIndex === ctx.myPlayerIndex) continue;
			const rawProfile = onlineProfiles[serverIndex];
			const profile    = rawProfile || {};
			ctx.players[serverIndex] = Object.assign(rules.createPlayer(total), {
				cells:  rules.initCells(width, length),
				key:    oppKeys[oppKeyIndex++],
				name:   profile.name   || `Player ${serverIndex + 1}`,
				color:  profile.color  || pickColor(),
				avatar: profile.avatar || (!rawProfile ? ctx.CPU_IMAGES[serverIndex % ctx.CPU_IMAGES.length] : null),
				isCpu:  !rawProfile,
			});
		}

		ctx.targetIndex = ctx.players.findIndex((p, i) => p && i !== ctx.myPlayerIndex);

		board.buildGrid(ctx.targetGridEl, { playerKey: ctx.players[ctx.targetIndex].key, myGrid: false, width, length });
		base.buildOceanGrid();
		base.resetPlacementState();

		base.setGamePhase('placing');
		[ctx.btnConfirm, ctx.btnRandom, ctx.btnRotate, ctx.btnReset].forEach(b => b.classList.add('off'));
		syncHostButtons();
		ctx.targetGridEl.classList.add('off');
		ctx.targetNavEl.classList.add('hide');
		ctx.btnPrevTarget.classList.add('hide');
		ctx.btnNextTarget.classList.add('hide');
		base.syncSelectors();
		base.togglePlacementBtns();
		ctx.renderPlayerCards();
	}

	// ---- Shared helpers ----

	function showRoomCode() {
		const el = document.getElementById('room-code-display');
		if (el) { el.textContent = `Room: ${getState().room}`; el.classList.remove('hide'); }
	}

	// ---- Reconnect ----

	function restoreCells(player, serverCells, serverColors) {
		serverCells.forEach((c, i) => {
			player.cells[i].shipId = c.shipId ?? null;
			player.cells[i].hit    = c.hit    || false;
			player.cells[i].miss   = c.miss   || false;
			player.cells[i].sunk   = c.sunk   || false;
			if ((c.hit || c.miss) && c.shotBy != null) {
				player.shotColors[i] = serverColors[c.shotBy] ?? null;
			}
		});
	}

	function applyGroup(groups, ships, domCells, fn) {
		Object.entries(groups).forEach(([id, indices]) => {
			const align = ships[id]?.align ?? base.inferAlign(indices);
			fn(indices.map(i => domCells[i]), align, Number(id));
		});
	}

	// Rebuild full client-side game state from a RECONNECT_STATE payload.
	function restoreGameState(data) {
		ctx.hostIndex = data.hostIndex ?? 0;
		showRoomCode();
		startOnlinePlacement({
			...data.settings,
			playerCount: data.players.length,
			profiles:    data.profiles,
		});

		const serverColors = ctx.players.map(p => p?.color);
		const me           = ctx.players[ctx.myPlayerIndex];
		const myCells      = board.getCells('p1');

		restoreCells(me, data.myPlayer.cells, serverColors);
		me.ships     = data.myPlayer.ships || [];
		me.shipsLeft = data.myPlayer.shipsLeft;
		me.status    = data.myPlayer.status ?? 'active';

		const shipGroups = {};
		const sunkGroups = {};
		me.cells.forEach((c, i) => {
			if (c.shipId != null) (shipGroups[c.shipId] ??= []).push(i);
			if (c.sunk)           (sunkGroups[c.shipId] ??= []).push(i);
			else if (c.hit)       board.applyHit(myCells[i], me.shotColors[i]);
			else if (c.miss)      board.applyMiss(myCells[i], me.shotColors[i]);
		});
		applyGroup(shipGroups, me.ships, myCells, (cells, align, id) => board.markShipCells(cells, id, align));
		applyGroup(sunkGroups, me.ships, myCells, (cells, align)     => board.applySunk(cells, align));

		data.opponents.forEach(opp => {
			const p = ctx.players[opp.playerIndex];
			if (!p) return;
			restoreCells(p, opp.cells, serverColors);
			if (opp.ships) p.ships = opp.ships;
			p.shipsLeft = opp.shipsLeft;
			p.status    = opp.status ?? 'active';
		});

		ctx.targetGridEl.classList.remove('off');
		base.updateArrows();
		ctx.players.forEach((p, i) => { if (p && p.status !== 'active') ctx.updatePlayerCard(i); });
		[ctx.btnConfirm, ctx.btnRandom, ctx.btnRotate, ctx.btnReset].forEach(b => b.classList.add('off'));
		ctx.shipSelectorEls.forEach(el => { el.classList.add('off'); el.removeAttribute('draggable'); });

		if (data.status === 'playing') {
			base.setGamePhase('playing');
			base.showTargetGrid(ctx.targetIndex);
			setMyTurn(data.turnIndex === ctx.myPlayerIndex, data.turnIndex);
			if (me.status === 'active') ctx.btnSurrender.classList.remove('off');
			syncHostButtons();
		} else if (data.gameStatus === 'placing' && data.myPlayer.shipsPlaced) {
			base.showTargetGrid(ctx.targetIndex);
			showToast('Reconnected - waiting for others to finish placing ships.', 'default', 5000);
		} else if (data.status === 'idle') {
			base.setGamePhase('idle');
			syncHostButtons();
			ctx.renderPlayerCards();
			// Start on the winner's board (or opponent[0] if winner is us / unknown).
			const localWinner = data.winnerIndex ?? -1;
			const firstOpp    = ctx.players.findIndex((p, i) => p && i !== ctx.myPlayerIndex);
			const reviewIndex = (localWinner >= 0 && localWinner !== ctx.myPlayerIndex) ? localWinner : firstOpp;
			ctx.targetIndex = reviewIndex;
			base.showReviewGrid(reviewIndex);
			if (ctx.players.length > 2) {
				ctx.targetNavEl.classList.remove('hide');
				ctx.btnPrevTarget.classList.remove('hide');
				ctx.btnNextTarget.classList.remove('hide');
			}
		}
	}

	// ---- Mode interface ----

	function startGame() {
		if (ctx.myPlayerIndex === ctx.hostIndex) {
			network.sendSettings({
				width:       ctx.pendingSettings.width,
				length:      ctx.pendingSettings.length,
				playerCount: ctx.pendingSettings.playerCount,
				ships:       ctx.pendingSettings.ships,
				firstTurn:   ctx.pendingSettings.firstTurn  || 'random',
				difficulty:  ctx.pendingSettings.difficulty || 'medium',
			});
		}
		network.sendNewGame();
	}

	function confirmPlacement() {
		if (base.getShipsPlaced() !== rules.shipTotal(ctx.settings.ships)) return;
		base.togglePlacementBtns();
		board.getCells('p1').forEach(td => td.removeAttribute('draggable'));
		const me = ctx.players[ctx.myPlayerIndex];
		network.sendPlacement(me.ships
			.map((ship, id) => ship
				? { id, type: ship.type, align: ship.align, indices: rules.getSunkIndices(me, id) }
				: null)
			.filter(Boolean));
	}

	function surrender() {
		network.sendSurrender();
	}

	function shoot(index) {
		if (base.gamePhase !== 'playing' || !ctx.myTurn) return;
		const cell = ctx.players[ctx.targetIndex]?.cells[index];
		if (!cell || cell.hit || cell.miss) return;
		setMyTurn(false);
		network.sendShot(index, ctx.targetIndex);
	}

	function exit() {
		if (base.exitConfirmation()) {
			network.sendLeaveGame();
			network.disconnect();
			navigate('lobby');
		}
	}

	// ---- Network event handlers ----

	network.onEvent('SETTINGS_UPDATED', (serverSettings) => {
		if (serverSettings.width)       ctx.settings.width       = serverSettings.width;
		if (serverSettings.length)      ctx.settings.length      = serverSettings.length;
		if (serverSettings.ships)       ctx.settings.ships       = serverSettings.ships;
		if (serverSettings.playerCount) ctx.settings.playerCount = serverSettings.playerCount;
		if (serverSettings.difficulty)  ctx.settings.difficulty  = serverSettings.difficulty;
		if (serverSettings.firstTurn)   ctx.settings.firstTurn   = serverSettings.firstTurn;
		// Mirror into pending so the panel shows the server's authoritative values.
		ctx.pendingSettings.width       = ctx.settings.width;
		ctx.pendingSettings.length      = ctx.settings.length;
		ctx.pendingSettings.ships       = { ...ctx.settings.ships };
		ctx.pendingSettings.playerCount = ctx.settings.playerCount;
		ctx.pendingSettings.difficulty  = ctx.settings.difficulty;
		ctx.pendingSettings.firstTurn   = ctx.settings.firstTurn;
		if (ctx.myPlayerIndex !== ctx.hostIndex)
			showToast('Host updated game settings.', 'default', 4000);
	});

	network.onEvent('NEW_GAME', ({ settings: s, profiles, playerCount }) => {
		ctx.myTurn = false;
		ctx.currentTurnServer = null;
		ctx.btnSurrender.classList.add('off');
		ctx.targetGridEl.classList.add('off');
		ctx.targetNavEl.classList.add('hide');
		ctx.btnPrevTarget.classList.add('hide');
		ctx.btnNextTarget.classList.add('hide');
		startOnlinePlacement({ ...s, profiles, playerCount });
		showToast('Place your ships.', 'default', 4000);
	});

	network.onEvent('SHIPS_PLACED_ACK', () =>
		showToast('Ships confirmed. Waiting for opponent...', 'default', 6000));

	network.onEvent('GAME_START', ({ firstTurnIndex }) => {
		base.setGamePhase('playing');
		setMyTurn(firstTurnIndex === ctx.myPlayerIndex, firstTurnIndex);
		ctx.btnSurrender.classList.remove('off');
		syncHostButtons();
		base.showTargetGrid(ctx.targetIndex);
		ctx.targetGridEl.classList.remove('off');
		base.updateArrows();
		const firstName = ctx.myTurn ? null : (ctx.players[firstTurnIndex]?.name ?? `Player ${firstTurnIndex + 1}`);
		showToast(ctx.myTurn ? 'Game started - your turn!' : `Game started - ${firstName}'s turn...`, 'default', 4000);
	});

	network.onEvent('SHOT', (data) => {
		const target = ctx.players[data.targetIndex];
		if (!target) return;
		const isSelf       = data.targetIndex === ctx.myPlayerIndex;
		const isMyShot     = data.shooterIndex === ctx.myPlayerIndex;
		if (isSelf && isMyShot) return;
		const shooter      = ctx.players[data.shooterIndex];
		const shooterColor = shooter?.color || ctx.players[ctx.myPlayerIndex].color;
		if (data.hit) {
			target.cells[data.cellIndex].hit = true;
			if (data.sunk) data.sunkIndices.forEach(i => {
				target.cells[i].sunk   = true;
				target.cells[i].shipId = data.shipId;
			});
		} else {
			target.cells[data.cellIndex].miss = true;
		}
		if (data.targetIndex === ctx.targetIndex || isSelf) {
			base.applyShotResult(
				board.getCells(isSelf ? 'p1' : target.key),
				target, data.cellIndex, data,
				isMyShot, shooterColor, isMyShot ? undefined : shooter
			);
		} else {
			target.shotColors[data.cellIndex] = shooterColor;
		}
		if (data.eliminated) {
			target.status = 'eliminated';
			ctx.updatePlayerCard(data.targetIndex);
			if (data.targetIndex === ctx.myPlayerIndex) {
				ctx.btnSurrender.classList.add('off');
			} else {
				showToast(`${target.name} was eliminated!`, 'default', 2500);
				if (data.targetIndex === ctx.targetIndex) base.moveTarget(1);
			}
			base.updateArrows();
		}
		if (isMyShot) {
			ctx.stats.addShot();
			if (data.hit) ctx.stats.addHit();
		}
		if (!data.gameOver) setMyTurn(data.nextTurnIndex === ctx.myPlayerIndex, data.nextTurnIndex);
	});

	network.onEvent('PLAYER_SURRENDERED', ({ playerIndex: surrenderedIndex, nextTurnIndex }) => {
		const p = ctx.players[surrenderedIndex];
		if (!p) return;

		p.status = 'surrendered';
		ctx.updatePlayerCard(surrenderedIndex);
		if (surrenderedIndex === ctx.myPlayerIndex) {
			ctx.btnSurrender.classList.add('off');
			showToast('You surrendered. Watching the rest of the game...', 'default', 4000);
		} else {
			const name = p.name ?? `Player ${surrenderedIndex + 1}`;
			showToast(`${name} surrendered!`, 'default', 4000);
		}

		if (base.gamePhase !== 'playing') return;
		if (surrenderedIndex === ctx.targetIndex) base.moveTarget(1);
		setMyTurn(nextTurnIndex === ctx.myPlayerIndex, nextTurnIndex);
		base.updateArrows();
	});

	network.onEvent('GAME_OVER', ({ winnerIndex, reveal }) => {
		const oldKey = ctx.players[ctx.currentTurnServer]?.key;
		if (oldKey) document.getElementById(`card-${oldKey}`)?.classList.remove('active-turn');
		ctx.currentTurnServer = null;
		if (Array.isArray(reveal)) {
			reveal.forEach((data, serverIndex) => {
				if (serverIndex === ctx.myPlayerIndex || !data) return;
				const p = ctx.players[serverIndex];
				if (!p) return;
				p.ships = data.ships;
				data.cellShipIds.forEach((shipId, i) => { if (p.cells[i]) p.cells[i].shipId = shipId; });
			});
		}
		if (base.gamePhase === 'playing') {
			const iWon       = winnerIndex === ctx.myPlayerIndex;
			const winnerName = ctx.players[winnerIndex]?.name ?? null;
			const firstOpp   = ctx.players.findIndex((p, i) => p && i !== ctx.myPlayerIndex);
			const reviewIndex = winnerIndex !== ctx.myPlayerIndex ? winnerIndex : firstOpp;
			endGame(iWon, iWon ? null : winnerName, reviewIndex);
		} else {
			base.showReviewGrid(ctx.targetIndex);
		}
	});

	// ---- Player connect/disconnect ----
	network.onEvent('PLAYER_JOINED_MIDGAME', ({ playerIndex, profile, status }) => {
		const p = ctx.players[playerIndex];
		if (!p) return;
		p.isCpu  = false;
		p.status = status;
		p.name   = profile?.name   || `Player ${playerIndex + 1}`;
		p.avatar = profile?.avatar || null;
		if (profile?.color) p.color = profile.color;
		ctx.updatePlayerCard(playerIndex);
		ctx.connectedCount++;
		showToast(`${p.name} joined the game.`, 'success', 4000);
	});

	network.onEvent('HOST_MIGRATED', ({ from, to }) => {
		ctx.hostIndex = to;
		syncHostButtons();
		ctx.updatePlayerCard(from);
		ctx.updatePlayerCard(to);
		if (to === ctx.myPlayerIndex) {
			showToast('You are now the host.', 'success', 5000);
		} else {
			const name = ctx.players[to]?.name ?? `Player ${to + 1}`;
			showToast(`${name} is now the host.`, 'default', 4000);
		}
	});

	function handlePlayerGone(serverIndex, { connectedCount, nextTurnIndex, verb = 'left' } = {}) {
		if (connectedCount != null) ctx.connectedCount = connectedCount;
		const p = ctx.players[serverIndex];
		if (p) {
			p.isCpu  = true;
			p.avatar = ctx.CPU_IMAGES[serverIndex % ctx.CPU_IMAGES.length];
			ctx.updatePlayerCard(serverIndex);
		}
		const name = p?.name ?? `Player ${serverIndex + 1}`;
		showToast(`${name} ${verb} - CPU taking over.`, 'default', 4000);
		if (base.gamePhase === 'playing' && nextTurnIndex != null) {
			setMyTurn(nextTurnIndex === ctx.myPlayerIndex, nextTurnIndex);
		}
	}

	network.onEvent('PLAYER_LEFT', ({ playerIndex, nextTurnIndex, connectedIndices }) =>
		handlePlayerGone(playerIndex, { connectedCount: connectedIndices?.length, nextTurnIndex, verb: 'left' }));

	network.onEvent('PLAYER_DISCONNECTED', ({ playerIndex, connectedIndices, nextTurnIndex }) =>
		handlePlayerGone(playerIndex, { connectedCount: connectedIndices?.length, nextTurnIndex, verb: 'disconnected' }));

	network.onEvent('DISCONNECT', () => {
		navigate('lobby');
		afterPaint(() => alert('Lost connection to server.'));
	});

	network.onEvent('SESSION_EXPIRED', ({ message }) => {
		network.disconnect();
		navigate('lobby');
		afterPaint(() => alert('Session Expired: ' + (message || 'Session time limit reached.')));
	});

	// Room close countdown
	let roomCloseTimeout  = null;
	let roomCloseInterval = null;
	let closeToast        = null;

	function startCloseCountdown(prefix, duration) {
		if (roomCloseTimeout) return;
		const container = document.getElementById('toast-container');
		if (!container) return;
		let remaining = Math.round(duration / 1000);
		const toast = document.createElement('div');
		toast.classList.add('toast', 'toast--danger');
		toast.textContent = `${prefix} ${remaining}s`;
		container.appendChild(toast);
		requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('toast--show')));
		closeToast = toast;
		roomCloseInterval = setInterval(() => {
			remaining--;
			if (closeToast) closeToast.textContent = `${prefix} ${Math.max(remaining, 0)}s`;
		}, 1000);
		roomCloseTimeout = setTimeout(() => { navigate('lobby'); }, duration);
	}

	function cancelCloseCountdown() {
		if (roomCloseTimeout)  { clearTimeout(roomCloseTimeout);   roomCloseTimeout  = null; }
		if (roomCloseInterval) { clearInterval(roomCloseInterval); roomCloseInterval = null; }
		if (closeToast) {
			closeToast.classList.remove('toast--show');
			closeToast.addEventListener('transitionend', () => closeToast?.remove(), { once: true });
			closeToast = null;
		}
	}

	network.onEvent('ROOM_CLOSING', ({ reason, duration }) => {
		const prefix =
			reason === 'session' ? 'Session ending in' :
			reason === 'idle'    ? 'Room closing (no game started) in' :
			                       'Last player remaining. Room closing in';
		startCloseCountdown(prefix, duration);
	});

	network.onEvent('ROOM_CLOSE_CANCELLED', () => {
		cancelCloseCountdown();
	});

	// ---- Pregame init (entered from waiting room after GAME_VIEW_OPEN) ----

	function initGame() {
		// Sync player count into settings so the panel slider reflects connected humans.
		ctx.settings.playerCount = ctx.connectedCount;
		ctx.pendingSettings.playerCount = ctx.connectedCount;

		// Only the host can start the game or change settings.
		syncHostButtons();
		showRoomCode();
		const onlineProfiles = getState().onlineProfiles || [];
		const playerCount    = getState().onlinePlayerCount || 2;
		const oppKeys        = ['p2', 'p3', 'p4'];
		const { playerName: pName, playerAvatar: pAvatar, playerColor: pColor } = getState();
		const pSessionColor = onlineProfiles[ctx.myPlayerIndex]?.color || pColor;

		const takenColors = new Set(pSessionColor ? [pSessionColor] : []);
		const pickColor   = () => {
			const c = ctx.COLOR_POOL.find(c => !takenColors.has(c)) ?? ctx.COLOR_POOL[0];
			takenColors.add(c);
			return c;
		};

		// Build lightweight player stubs in server index order for the idle pregame display.
		// Replaced with full player objects by startOnlinePlacement() when NEW_GAME fires.
		ctx.players = new Array(playerCount);
		ctx.players[ctx.myPlayerIndex] = Object.assign(rules.createPlayer(0), {
			cells: [], key: 'p1',
			name:   (!pName || /^Player \d+$/.test(pName)) ? `Player ${ctx.myPlayerIndex + 1}` : pName,
			color:  pSessionColor, avatar: pAvatar || null,
		});
		let oppKeyIndex = 0;
		for (let serverIndex = 0; serverIndex < playerCount; serverIndex++) {
			if (serverIndex === ctx.myPlayerIndex) continue;
			const profile = onlineProfiles[serverIndex] || null;
			ctx.players[serverIndex] = Object.assign(rules.createPlayer(0), {
				cells: [], key: oppKeys[oppKeyIndex++],
				name:   profile?.name   || `Player ${serverIndex + 1}`,
				color:  profile?.color  || pickColor(),
				avatar: profile?.avatar || (!profile ? ctx.CPU_IMAGES[serverIndex % ctx.CPU_IMAGES.length] : null),
				isCpu:  !profile,
			});
		}
		ctx.renderPlayerCards();
	}

	const savedGameState = getState().savedGameState;
	if (savedGameState) {
		setState({ savedGameState: null });
		restoreGameState(savedGameState);
	} else {
		initGame();
	}

	function endGame(iWon, winnerName = null, reviewIndex = null) {
		base.finishGame(iWon, winnerName, reviewIndex);
		syncHostButtons();
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
