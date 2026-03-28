// ============================================================
// ROUTER - view switching.
// navigate(view, params) clears #app and mounts the requested view.
// ============================================================

import { mount as mountLobby } from './views/lobby.js';
import { mount as mountGame } from './views/game.js';
import { mount as mountRoom } from './views/waitingRoom.js';

const app = document.getElementById('app');

export function navigate(view, params) {
	app.innerHTML = '';
	switch (view) {
		case 'lobby':   mountLobby(app); break;
		case 'waiting': mountRoom(app); break;
		case 'game':    mountGame(app, params); break;
		default: console.error(`Unknown view: "${view}"`);
	}
}
