// ============================================================
// PLAYER CARDS - renders and updates the row of player-card
// elements in the right column panel.
//
// ctx must expose getters for mutable closure variables so this
// module always reads the current value, not a stale snapshot:
//   ctx.players        - players[]
//   ctx.hostIndex      - current host server index
//   ctx.isOnline       - boolean
//   ctx.playerCardsEl  - the container DOM element
// ============================================================

import { esc } from '../shared/utils.js';

export function init(ctx) {
	function buildCardHTML(p, isHost) {
		const avatarSrc = esc(p.avatar || './assets/default.png');
		const classes   = p.status === 'eliminated' ? 'player-card inactive eliminated'
			: p.status === 'surrendered'         ? 'player-card inactive surrendered'
			:                                       'player-card';
		const cardStyle = p.color ? ` style="--card-color:${p.color}"` : '';
		const name = esc(p.name);
		return `
		<div class="${classes}" id="card-${p.key}"${cardStyle}>
			<div class="player-card__img-wrap">
				<img src="${avatarSrc}" alt="${name}">
				<div class="player-card__x"></div>
				${p.isCpu ? '<span class="player-card__badge cpu">CPU</span>' : isHost ? '<span class="player-card__badge host">HOST</span>' : ''}
			</div>
			<div class="player-card__info">
				<p>${name}</p>
			</div>
		</div>`;
	}

	function renderPlayerCards() {
		const { players, isOnline, hostIndex, playerCardsEl } = ctx;
		playerCardsEl.innerHTML = players.map((p, i) => {
			const isHost = isOnline && i === hostIndex;
			return buildCardHTML(p, isHost);
		}).join('');
	}

	function updatePlayerCard(idx) {
		const { players, isOnline, hostIndex } = ctx;
		const p    = players[idx];
		if (!p) return;
		const card = document.getElementById(`card-${p.key}`);
		if (!card) return;
		card.outerHTML = buildCardHTML(p, isOnline && idx === hostIndex);
	}

	return { renderPlayerCards, updatePlayerCard };
}
