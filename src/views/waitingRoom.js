// ============================================================
// WAITING ROOM VIEW - shown after AUTH while players gather.
// Host can start once at least 2 players are present.
// Navigates to 'game' when the server broadcasts GAME_VIEW_OPEN.
// ============================================================

import { navigate }           from '../router.js';
import { getState, setState } from '../state.js';
import * as network           from '../network.js';
import { showToast, COLOR_POOL, esc, afterPaint } from '../shared/utils.js';

const MAX_PLAYERS = 4;

export function mount(container) {
	const { room, playerIndex: myPlayerIndex, connectedIndices, onlineProfiles } = getState();

	container.innerHTML = html(room);

	const connected = new Set(connectedIndices || [myPlayerIndex]);

	// Local mutable profile map: index -> { name, avatar, color }
	const profiles = Array.isArray(onlineProfiles) ? [...onlineProfiles] : [];

	bindEvents(myPlayerIndex, connected, profiles);
}

// ---- HTML template ----

function html(code) {
	return `
		<header><img src="./assets/title.png" alt="Battleship"></header>
		<div class="lobby lobby--waiting">
			<section class="panel">
				<h2 class="panel__heading">Waiting Room</h2>
				<p class="panel__label">Share this code with friends</p>
				<div class="room-code">${code}</div>
				<div id="waiting-slots" class="waiting-slots"></div>
				<p id="waiting-status" class="panel__status">Waiting for host to start&hellip;</p>
				<button id="btn-leave" class="panel__btn panel__btn--secondary">&#8592; Leave</button>
			</section>
		</div>
		<div id="toast-container"></div>`;
}

// ---- Slots ----

function renderSlots(slotsEl, connected, myPlayerIndex, profiles, hostIndex = 0) {
	const isHost  = myPlayerIndex === hostIndex;
	const myColor = profiles[myPlayerIndex]?.color || getState().playerColor;
	slotsEl.innerHTML = Array.from({ length: MAX_PLAYERS }, (_, i) => {
		const filled   = connected.has(i);
		const profile  = profiles[i] || {};
		const fallback = `Player ${i + 1}`;
		const label    = filled ? esc(profile.name || fallback) : 'Empty';
		const isMe     = i === myPlayerIndex;
		const you      = isMe && filled ? ' <span class="waiting-slot__you">(you)</span>' : '';
		const color    = filled ? (isMe ? myColor : profile.color) : null;
		const dotStyle = color ? `style="background:${color};box-shadow:0 0 6px ${color}88"` : '';
		const dotExtra = isMe && filled ? 'data-my-dot' : '';
		const slotExtra = isMe && filled ? 'data-my-slot title="Click to change color"' : '';
		const hostTag  = filled && i === hostIndex
			? '<span class="waiting-slot__host">HOST</span>'
			: '';
		const kickBtn  = isHost && filled && !isMe
			? `<button class="waiting-slot__kick" data-kick="${i}" title="Kick player">✕</button>`
			: '';
		return `
			<div class="waiting-slot ${filled ? 'waiting-slot--joined' : 'waiting-slot--empty'}" ${slotExtra}>
				<span class="waiting-slot__dot" ${dotStyle} ${dotExtra}></span>
				<span class="waiting-slot__name">${label}${you}</span>
				${hostTag}
				${kickBtn}
			</div>`;
	}).join('');
}

// ---- Events ----

function bindEvents(myPlayerIndex, connected, profiles) {
	const slotsEl = document.getElementById('waiting-slots');

	let hostIndex = getState().onlineHostIndex ?? 0; // server index of the current host

	const syncConnected = (indices) => {
		connected.clear();
		(indices || []).forEach(i => connected.add(i));
	};

	const playerName = (idx) => profiles[idx]?.name || `Player ${idx + 1}`;

	// Swap the host-only UI in or out depending on whether we are currently host.
	function syncHostUI() {
		const panel  = document.querySelector('.panel');
		const isHost = myPlayerIndex === hostIndex;
		const hasBtn = !!document.getElementById('btn-start-game');

		if (isHost && !hasBtn) {
			const statusEl = panel?.querySelector('#waiting-status');
			if (statusEl) {
				const btn       = document.createElement('button');
				btn.id          = 'btn-start-game';
				btn.className   = 'panel__btn';
				btn.textContent = 'Start Game';
				btn.disabled    = connected.size < 2;
				btn.addEventListener('click', () => { if (!btn.disabled) network.sendStartGame(); });
				statusEl.replaceWith(btn);
			}
		} else if (!isHost && hasBtn) {
			const btnStartGame = document.getElementById('btn-start-game');
			if (btnStartGame) {
				const status     = document.createElement('p');
				status.id        = 'waiting-status';
				status.className = 'panel__status';
				status.textContent = 'Waiting for host to start\u2026';
				btnStartGame.replaceWith(status);
			}
		} else if (isHost && hasBtn) {
			document.getElementById('btn-start-game').disabled = connected.size < 2;
		}
	}

	function refresh() {
		renderSlots(slotsEl, connected, myPlayerIndex, profiles, hostIndex);
		syncHostUI();
	}
	refresh();

	network.onEvent('PLAYER_JOINED', ({ playerIndex, connectedIndices, profile }) => {
		connectedIndices.forEach(i => connected.add(i));
		if (profile) profiles[playerIndex] = profile;
		refresh();
		if (playerIndex !== myPlayerIndex) {
			showToast(`${playerName(playerIndex)} joined!`, 'success', 2500);
		}
	});

	network.onEvent('PLAYER_DISCONNECTED', ({ playerIndex, connectedIndices }) => {
		// Reset to the server's authoritative list rather than just deleting one index,
		// so the client can't drift out of sync across multiple join/leave cycles.
		syncConnected(connectedIndices);
		refresh();
		if (playerIndex !== myPlayerIndex) {
			showToast(`${playerName(playerIndex)} left.`, 'default', 2500);
		}
	});

	network.onEvent('GAME_VIEW_OPEN', ({ settings, playerCount, profiles: serverProfiles, hostIndex: serverHostIndex }) => {
		setState({
			connectedIndices:  [...connected],
			onlineSettings:    settings,
			onlinePlayerCount: playerCount,
			onlineProfiles:    serverProfiles,
			onlineHostIndex:   serverHostIndex ?? 0,
		});
		navigate('game', 'online');
	});

	network.onEvent('PLAYER_PROFILE_UPDATED', ({ playerIndex: idx, profile }) => {
		if (profile) profiles[idx] = { ...profiles[idx], ...profile };
		refresh();
	});

	network.onEvent('DISCONNECT', () => {
		showToast('Lost connection to server.', 'danger', 4000);
		setTimeout(() => navigate('lobby'), 2000);
	});

	network.onEvent('HOST_MIGRATED', ({ to }) => {
		hostIndex = to;
		refresh();
		if (to === myPlayerIndex) {
			showToast('You are now the host.', 'success', 4000);
		} else {
			showToast(`${playerName(to)} is now the host.`, 'default', 3000);
		}
	});

	network.onEvent('PLAYER_KICKED', ({ playerIndex, connectedIndices }) => {
		syncConnected(connectedIndices);
		refresh();
		showToast(`${playerName(playerIndex)} was removed by the host.`, 'default', 3000);
	});

	network.onEvent('KICKED', () => {
		network.disconnect();
		navigate('lobby');
		afterPaint(() => alert('You were removed from the room by the host.'));
	});

	slotsEl.addEventListener('click', e => {
		const kickTarget = e.target.closest('[data-kick]');
		if (kickTarget) {
			network.sendKickPlayer(Number(kickTarget.dataset.kick));
			return;
		}
		if (!e.target.closest('[data-my-slot]')) return;
		const takenColors = new Set(
			profiles.filter((p, i) => p && connected.has(i) && i !== myPlayerIndex).map(p => p.color)
		);
		const current = profiles[myPlayerIndex]?.color || getState().playerColor;
		const available = COLOR_POOL.filter(c => !takenColors.has(c));
		if (available.length === 0) return;
		const idx = available.indexOf(current);
		const nextColor = available[(idx + 1) % available.length];
		profiles[myPlayerIndex] = { ...profiles[myPlayerIndex], color: nextColor };
		setState({ onlineProfiles: [...profiles] });
		refresh();
		network.sendUpdateProfile({ color: nextColor });
	});

	document.getElementById('btn-leave').addEventListener('click', () => {
		network.sendLeave();
		network.disconnect();
		navigate('lobby');
	});
}
