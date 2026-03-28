// ============================================================
// SHARED UTILITIES
// ============================================================

export const COLOR_POOL = ['#4fc3f7', '#b39ddb', '#ffd54f', '#ffb74d', '#f48fb1', '#a5d6a7'];

// Escape HTML special characters to prevent injection when interpolating into innerHTML.
export function esc(str) {
	return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Run fn after the browser has painted the current DOM changes.
export function afterPaint(fn) {
	requestAnimationFrame(() => requestAnimationFrame(fn));
}

// Appends a self-removing toast to #toast-container.
// type: 'default' | 'success' | 'danger'
export function showToast(message, type = 'default', duration = 2500) {
	const container = document.getElementById('toast-container');
	if (!container) return;
	const toast = document.createElement('div');
	toast.classList.add('toast', `toast--${type}`);
	toast.textContent = message;
	container.appendChild(toast);
	requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('toast--show')));
	setTimeout(() => {
		toast.classList.remove('toast--show');
		toast.addEventListener('transitionend', () => toast.remove(), { once: true });
	}, duration);
}
