// ============================================================
// LOBBY VIEW - HTML template + event wiring.
// Online actions delegate to network.js; routing delegates to router.js.
// ============================================================

import { navigate }            from '../router.js';
import { getState, setState }  from '../state.js';
import * as network            from '../network.js';
import { sanitizeImage }       from '../shared/imageUtils.js';

export function mount(container) {
	container.innerHTML = html();
	bindEvents();
}

// ---- HTML template ----

function html() {
	return `
		<header><img src="./assets/title.png" alt="Battleship"></header>
		<div class="lobby">

			<!-- Main menu panel -->
			<section id="panel-main" class="panel">
				<h2 class="panel__heading">Command Center</h2>

				<div class="lobby__profile">
					<div class="lobby__avatar-wrap" id="avatar-wrap" title="Click to change avatar">
						<img id="avatar-preview" src="./assets/default.png" alt="Your avatar">
						<div class="lobby__avatar-overlay"><i class="fas fa-camera"></i></div>
					</div>
					<input id="avatar-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hide">
					<input id="name-input" type="text" class="lobby__name-input" maxlength="12"
						placeholder="Enter your name" autocomplete="off" spellcheck="false">
					<div class="lobby__colors" id="color-picker">
						<button class="color-swatch" data-color="#4fc3f7" style="background:#4fc3f7" title="Blue"></button>
						<button class="color-swatch" data-color="#b39ddb" style="background:#b39ddb" title="Purple"></button>
						<button class="color-swatch" data-color="#ffd54f" style="background:#ffd54f" title="Yellow"></button>
						<button class="color-swatch" data-color="#ffb74d" style="background:#ffb74d" title="Orange"></button>
						<button class="color-swatch" data-color="#f48fb1" style="background:#f48fb1" title="Pink"></button>
						<button class="color-swatch" data-color="#a5d6a7" style="background:#a5d6a7" title="Green"></button>
					</div>
					<p id="avatar-error" class="lobby__error hide"></p>
				</div>

				<button id="btn-vs-computer" class="panel__btn">Play vs Computer</button>
				<button id="btn-host"        class="panel__btn">Host Game</button>
				<button id="btn-join-nav"    class="panel__btn">Join Game</button>
			</section>

			<!-- Join panel: enter the host's room code -->
			<section id="panel-join" class="panel hide">
				<h2 class="panel__heading">Join Game</h2>
				<p class="panel__label">Enter the room code:</p>
				<input id="code-input" type="text" maxlength="6" placeholder="XXXXXX"
					class="lobby__code-input" autocomplete="off" spellcheck="false">
				<p id="join-error" class="lobby__error lobby__error--hidden">Invalid code. Please try again.</p>
				<button id="btn-join"        class="panel__btn">Join</button>
				<button id="btn-cancel-join" class="panel__btn panel__btn--secondary">&#8592; Back</button>
			</section>

		</div>
		<div class="lobby__links">
			<a href="https://github.com/dev-the-dev7" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i></a>
			<a href="https://www.linkedin.com/in/dv13/" target="_blank" rel="noopener noreferrer"><i class="fab fa-linkedin-in"></i></a>
		</div>`;
}

// ---- Event wiring ----

function bindEvents() {
	const panels    = ['panel-main', 'panel-join'];
	const showPanel = (id) => panels.forEach(p =>
		document.getElementById(p).classList.toggle('hide', p !== id));

	// ---- Avatar picker ----
	const { playerName, playerAvatar } = getState();
	const nameInput     = document.getElementById('name-input');
	const avatarPreview = document.getElementById('avatar-preview');
	const avatarInput   = document.getElementById('avatar-input');
	const avatarError   = document.getElementById('avatar-error');

	nameInput.value = playerName !== 'Player 1' ? playerName : '';
	if (playerAvatar) avatarPreview.src = playerAvatar;

	document.getElementById('avatar-wrap').addEventListener('click', () => avatarInput.click());

	avatarInput.addEventListener('change', async () => {
		const file = avatarInput.files[0];
		if (!file) return;
		avatarError.classList.add('hide');
		try {
			const dataUrl = await sanitizeImage(file);
			avatarPreview.src = dataUrl;
			setState({ playerAvatar: dataUrl });
		} catch (err) {
			if (!err.cancelled) {
				avatarError.textContent = err.message;
				avatarError.classList.remove('hide');
			}
		}
		avatarInput.value = '';
	});

	nameInput.addEventListener('input', () => {
		const name = nameInput.value.trim() || 'Player 1';
		setState({ playerName: name });
	});

	// ---- Color picker ----
	function syncSwatches(activeColor) {
		document.querySelectorAll('.color-swatch').forEach(btn => {
			btn.classList.toggle('color-swatch--active', btn.dataset.color === activeColor);
		});
	}
	syncSwatches(getState().playerColor);
	document.getElementById('color-picker').addEventListener('click', e => {
		const btn = e.target.closest('.color-swatch');
		if (!btn) return;
		setState({ playerColor: btn.dataset.color });
		syncSwatches(btn.dataset.color);
	});

	// Local game - navigate straight to the game view, no room needed
	document.getElementById('btn-vs-computer').addEventListener('click', () => {
		setState({ mode: 'cpu' });
		navigate('game', 'cpu');
	});

	// Host Game - create room immediately, navigate straight to waiting room
	document.getElementById('btn-host').addEventListener('click', handleHost);

	document.getElementById('btn-join-nav').addEventListener('click', () => showPanel('panel-join'));
	document.getElementById('btn-join').addEventListener('click', handleJoin);

	document.getElementById('code-input').addEventListener('input', () =>
		document.getElementById('join-error').classList.add('lobby__error--hidden'));

	document.getElementById('btn-cancel-join').addEventListener('click', () => {
		network.disconnect();
		showPanel('panel-main');
	});
}

// ---- Action handlers ----

function registerAuthOK() {
	network.onEvent('AUTH_OK', ({ playerIndex, hostIndex, playerCount, connectedIndices, settings, profiles }) => {
		setState({
			playerIndex,
			playerCount,
			connectedIndices,
			onlineSettings:  settings,
			onlineProfiles:  profiles,
			onlineHostIndex: hostIndex ?? 0,
		});
		navigate('waiting');
	});
}

// Build the AUTH profile from current state.
// Names matching the default pattern are sent as null so the server uses a slot-based fallback.
function buildAuthProfile() {
	const { playerName, playerAvatar, playerColor } = getState();
	return {
		name:   /^Player \d+$/.test(playerName) ? null : playerName,
		avatar: playerAvatar || './assets/default.png',
		color:  playerColor,
	};
}

async function handleHost() {
	try {
		const { code, playerId } = await network.createRoom();
		setState({ room: code, playerId, mode: 'online', playerIndex: null });

		await network.connect(`ws://${location.host}`);

		registerAuthOK();
		network.auth(code, playerId, buildAuthProfile());
	} catch (err) {
		console.error('Host error:', err);
	}
}

async function handleJoin() {
	const input = document.getElementById('code-input').value.toUpperCase().trim();
	const joinError = document.getElementById('join-error');

	try {
		const { code, playerId } = await network.joinRoom(input);
		setState({ room: code, playerId, mode: 'online', playerIndex: null });

		await network.connect(`ws://${location.host}`);

		// Mid-game slot claim: server sends RECONNECT_STATE instead of AUTH_OK.
		// For idle (pre-first-game): navigate to game view without saving savedGameState so
		// initGame runs the normal card-display path rather than restoreGameState.
		network.onEvent('RECONNECT_STATE', (data) => {
			const { playerIndex, hostIndex, settings, profiles } = data;
			if (data.status === 'idle' && !data.myPlayer) {
				const connectedIndices = data.players
					.filter(p => !p.isCpu && !p.disconnected)
					.map(p => p.playerIndex);
				setState({
					playerIndex,
					onlineSettings:    settings,
					onlineProfiles:    profiles,
					onlineHostIndex:   hostIndex ?? 0,
					onlinePlayerCount: data.playerCount ?? data.players.length,
					connectedIndices,
					savedGameState:    null,
				});
			} else {
				const connectedIndices = data.players
					.filter(p => !p.isCpu && !p.disconnected)
					.map(p => p.playerIndex);
				setState({
					playerIndex,
					onlineSettings:    settings,
					onlineProfiles:    profiles,
					onlineHostIndex:   hostIndex ?? 0,
					onlinePlayerCount: data.playerCount ?? data.players.length,
					connectedIndices,
					savedGameState:    data,
				});
			}
			navigate('game', 'online');
		});

		registerAuthOK();

		network.onEvent('ERROR', ({ message }) => {
			network.disconnect();
			joinError.textContent = message || 'Could not join room.';
			joinError.classList.remove('lobby__error--hidden');
		});

		network.auth(code, playerId, buildAuthProfile());
	} catch (err) {
		joinError.textContent = err.message || 'Invalid code or room is full.';
		joinError.classList.remove('lobby__error--hidden');
	}
}
