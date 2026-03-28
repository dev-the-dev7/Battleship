// ============================================================
// SETTINGS PANEL - wires up all slider/select/tab listeners
// and syncs their displayed values from the settings object.
//
// settings is mutated in place as the user adjusts controls.
// Call init() once after the DOM is ready.
// Call sync() whenever you open the panel to reflect current state.
// ============================================================

// Ship type -> { sliderId, key, labelId }
const SHIP_SLIDERS = [
	{ sliderId: 'car-slider',   key: 'carrier',    labelId: 'car'   },
	{ sliderId: 'batle-slider', key: 'battleship', labelId: 'batle' },
	{ sliderId: 'cru-slider',   key: 'cruiser',    labelId: 'cru'   },
	{ sliderId: 'subm-slider',  key: 'submarine',  labelId: 'sub'   },
	{ sliderId: 'des-slider',   key: 'destroyer',  labelId: 'des'   },
];

// init - attach all event listeners to settings panel controls.
// shipTotal(ships)        - rules.shipTotal; used to enforce ≥1 ship constraint.
// getMinPlayerCount()     - optional; returns the minimum allowed player count
//                           (number of connected humans in online mode).
export function init(settingsScreenEl, settings, { shipTotal, getMinPlayerCount = null }) {
	// Tab switching + close button
	settingsScreenEl.addEventListener('click', e => {
		if (e.target.nodeName !== 'BUTTON') return;
		if (e.target.classList.contains('settings-tab')) {
			document.querySelectorAll('.settings-tab').forEach(t => t.classList.toggle('active', t === e.target));
			document.querySelectorAll('.settings-panel').forEach(p => p.classList.toggle('hide', p.id !== `tab-${e.target.dataset.tab}`));
			return;
		}
		if (e.target.id === 'btn-settings-close') {
			settingsScreenEl.classList.add('hide');
		}
	});

	// Grid size sliders
	document.getElementById('col-slider').addEventListener('input', e => {
		settings.width = parseInt(e.target.value);
		document.getElementById('col').textContent = settings.width;
	});
	document.getElementById('row-slider').addEventListener('input', e => {
		settings.length = parseInt(e.target.value);
		document.getElementById('row').textContent = settings.length;
	});

	// Ship count sliders - enforce at least 1 ship total
	function shipSlider(sliderId, key, labelId) {
		document.getElementById(sliderId).addEventListener('input', e => {
			const slider = e.target;
			const others = shipTotal(settings.ships) - settings.ships[key];
			const newVal = Math.max(parseInt(slider.value), others === 0 ? 1 : 0);
			slider.value = newVal;
			settings.ships[key] = newVal;
			document.getElementById(labelId).textContent = newVal;
		});
	}
	SHIP_SLIDERS.forEach(({ sliderId, key, labelId }) => shipSlider(sliderId, key, labelId));

	document.getElementById('difficulty-select').addEventListener('change', e => {
		settings.difficulty = e.target.value;
	});

	document.getElementById('player-count-select').addEventListener('change', e => {
		const min = getMinPlayerCount?.() ?? 2;
		const val = Math.max(parseInt(e.target.value), min);
		e.target.value       = String(val);
		settings.playerCount = val;
	});

	document.getElementById('first-turn-select').addEventListener('change', e => {
		settings.firstTurn = e.target.value;
	});
}

// sync - update all panel controls to reflect the current settings values.
// Call this before opening the panel.
// getMinPlayerCount() - optional; disables options below the minimum.
export function sync(settings, getMinPlayerCount = null) {
	document.getElementById('first-turn-select').value = settings.firstTurn || 'random';
	document.getElementById('col-slider').value = settings.width;
	document.getElementById('row-slider').value = settings.length;
	document.getElementById('col').textContent  = settings.width;
	document.getElementById('row').textContent  = settings.length;

	SHIP_SLIDERS.forEach(({ sliderId, key, labelId }) => {
		const count = settings.ships[key] ?? 1;
		document.getElementById(sliderId).value    = count;
		document.getElementById(labelId).textContent = count;
	});

	// Disable player count options below the connected-player minimum and sync the selected value
	const min = getMinPlayerCount?.() ?? 2;
	document.querySelectorAll('#player-count-select option').forEach(opt => {
		opt.disabled = parseInt(opt.value) < min;
	});
	document.getElementById('player-count-select').value = String(Math.max(settings.playerCount || 2, min));
}
