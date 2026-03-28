// ============================================================
// APPLICATION STATE - plain object store.
// Updated via setState(); read with getState().
// Profile fields (name, avatar, color) auto-persist to localStorage.
// ============================================================

import { COLOR_POOL } from './shared/utils.js';

const PROFILE_KEY    = 'bs_profile';
const PROFILE_FIELDS = ['playerName', 'playerAvatar', 'playerColor'];

function loadProfile() {
	try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch { return {}; }
}

function saveProfile(state) {
	localStorage.setItem(PROFILE_KEY, JSON.stringify(
		Object.fromEntries(PROFILE_FIELDS.map(k => [k, state[k]]))
	));
}

const saved = loadProfile();

const appState = {
	mode:           null,   // 'cpu' | 'online'
	room:           null,   // room code string
	playerId:       null,   // assigned by server in online mode
	playerIndex:    null,   // 0 = host, 1 = guest (set from AUTH_OK)
	onlineSettings: null,   // server game settings (set from AUTH_OK / SETTINGS_UPDATED)
	playerName:     saved.playerName   ?? 'Player 1',
	playerAvatar:   saved.playerAvatar ?? null,
	playerColor:    saved.playerColor  ?? COLOR_POOL[0],
};

export function getState() {
	return appState;
}

export function setState(partial) {
	Object.assign(appState, partial);
	if (PROFILE_FIELDS.some(k => k in partial)) saveProfile(appState);
}
