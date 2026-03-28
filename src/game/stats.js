// ============================================================
// STATS PANEL - tracks wins, losses, hit accuracy for the
// current session. Called once per game init; reads DOM
// elements that are always present in the game template.
// ============================================================

export function createStats() {
	const el = {
		wins:   document.getElementById('wins'),
		losses: document.getElementById('losses'),
		wr:     document.getElementById('win-rate'),
		acc:    document.getElementById('accuracy'),
	};
	let wins = 0, losses = 0, hits = 0, shots = 0;

	const winRate  = () => el.wr.textContent  = `Win Rate: ${wins + losses ? Math.round(wins / (wins + losses) * 100) : 0}%`;
	const accuracy = () => el.acc.textContent = `Accuracy: ${shots ? Math.round(hits / shots * 100) : 0}%`;

	return {
		addWin()  { ++wins;   el.wins.textContent   = `Wins: ${wins}`;     winRate(); },
		addLoss() { ++losses; el.losses.textContent = `Losses: ${losses}`; winRate(); },
		addHit()  { ++hits;   accuracy(); },
		addShot() { ++shots;  accuracy(); },
	};
}
