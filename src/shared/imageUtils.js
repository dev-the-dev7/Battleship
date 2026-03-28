// ============================================================
// IMAGE UTILS - client-side avatar sanitization.
// Re-encodes via canvas to strip any non-pixel payloads.
// ============================================================

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES     = 10 * 1024 * 1024;
const AVATAR_SIZE   = 64;

// Reads a File, shows an interactive crop UI, then re-encodes the cropped
// region through a canvas. Returns a clean data:image/jpeg;base64 URL.
export function sanitizeImage(file) {
	if (!ALLOWED_TYPES.includes(file.type)) {
		throw new Error('Only JPEG, PNG, WebP, or GIF images are allowed.');
	}
	if (file.size > MAX_BYTES) {
		throw new Error('Image must be 10 MB or smaller.');
	}

	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => showCropUI(img, url, resolve, reject);

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Could not read the image file.'));
		};

		img.src = url;
	});
}

function showCropUI(img, objectUrl, resolve, reject) {
	const MAX_DIM = 320;
	const nw = img.naturalWidth;
	const nh = img.naturalHeight;

	// Scale image to fit within MAX_DIM (upscale tiny images so the UI is usable).
	const scale = MAX_DIM / Math.max(nw, nh);
	const dispW = Math.round(nw * scale);
	const dispH = Math.round(nh * scale);
	const invScale = 1 / scale;

	// Crop box: 95% of the shorter display dimension, centred.
	const boxSize = Math.round(Math.min(dispW, dispH) * 0.95);
	let boxX = Math.round((dispW - boxSize) / 2);
	let boxY = Math.round((dispH - boxSize) / 2);

	// ---- Build DOM ----

	const modal = document.createElement('div');
	modal.className = 'crop-modal';

	const card = document.createElement('div');
	card.className = 'crop-modal__card';

	const title = document.createElement('p');
	title.className = 'crop-modal__title';
	title.textContent = 'Drag to position your avatar';

	const wrap = document.createElement('div');
	wrap.className = 'crop-wrap';
	wrap.style.width  = `${dispW}px`;
	wrap.style.height = `${dispH}px`;

	const imgEl = document.createElement('img');
	imgEl.src          = objectUrl;
	imgEl.className    = 'crop-wrap__img';
	imgEl.style.width  = `${dispW}px`;
	imgEl.style.height = `${dispH}px`;
	imgEl.draggable = false;

	// Four divs that darken everything outside the crop box.
	const [oTop, oBot, oLeft, oRight] = Array.from({ length: 4 }, () => {
		const d = document.createElement('div');
		d.className = 'crop-shadow';
		return d;
	});

	const cropBox = document.createElement('div');
	cropBox.className = 'crop-box';
	cropBox.style.width  = `${boxSize}px`;
	cropBox.style.height = `${boxSize}px`;

	wrap.append(imgEl, oTop, oBot, oLeft, oRight, cropBox);

	const actions = document.createElement('div');
	actions.className = 'crop-modal__actions';

	const btnCancel  = document.createElement('button');
	btnCancel.className   = 'off';
	btnCancel.textContent = 'Cancel';

	const btnConfirm = document.createElement('button');
	btnConfirm.textContent = 'Crop & Save';

	actions.append(btnCancel, btnConfirm);
	card.append(title, wrap, actions);
	modal.appendChild(card);
	document.body.appendChild(modal);

	// ---- Layout update ----

	function updateLayout() {
		oTop.style.cssText   = `top:0;left:0;right:0;height:${boxY}px`;
		oBot.style.cssText   = `top:${boxY + boxSize}px;left:0;right:0;bottom:0`;
		oLeft.style.cssText  = `top:${boxY}px;left:0;width:${boxX}px;height:${boxSize}px`;
		oRight.style.cssText = `top:${boxY}px;left:${boxX + boxSize}px;right:0;height:${boxSize}px`;
		cropBox.style.left   = `${boxX}px`;
		cropBox.style.top    = `${boxY}px`;
	}

	updateLayout();

	// ---- Drag logic ----

	const ac = new AbortController();
	const sig = { signal: ac.signal };
	let dragging = false;
	let startCX = 0, startCY = 0, startBX = 0, startBY = 0;

	function onDragStart(cx, cy) {
		dragging = true;
		startCX = cx; startCY = cy;
		startBX = boxX; startBY = boxY;
	}

	function onDragMove(cx, cy) {
		if (!dragging) return;
		boxX = Math.max(0, Math.min(dispW - boxSize, startBX + cx - startCX));
		boxY = Math.max(0, Math.min(dispH - boxSize, startBY + cy - startCY));
		updateLayout();
	}

	wrap.addEventListener('mousedown', e => { onDragStart(e.clientX, e.clientY); e.preventDefault(); });
	document.addEventListener('mousemove', e => onDragMove(e.clientX, e.clientY), sig);
	document.addEventListener('mouseup',   () => { dragging = false; }, sig);

	wrap.addEventListener('touchstart', e => {
		const t = e.touches[0];
		onDragStart(t.clientX, t.clientY);
		e.preventDefault();
	}, { passive: false });
	document.addEventListener('touchmove', e => {
		const t = e.touches[0];
		onDragMove(t.clientX, t.clientY);
	}, sig);
	document.addEventListener('touchend', () => { dragging = false; }, sig);

	// ---- Actions ----

	function cleanup() {
		ac.abort();
		URL.revokeObjectURL(objectUrl);
		document.body.removeChild(modal);
	}

	btnCancel.addEventListener('click', () => {
		cleanup();
		const err = new Error('Crop cancelled.');
		err.cancelled = true;
		reject(err);
	});

	btnConfirm.addEventListener('click', () => {
		const sx    = boxX * invScale;
		const sy    = boxY * invScale;
		const sSize = boxSize * invScale;

		const canvas = document.createElement('canvas');
		canvas.width  = AVATAR_SIZE;
		canvas.height = AVATAR_SIZE;
		canvas.getContext('2d').drawImage(img, sx, sy, sSize, sSize, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

		cleanup();
		resolve(canvas.toDataURL('image/jpeg', 0.85));
	});
}
