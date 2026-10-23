/**
 * Pictures for studio slides. A deck is saved in a text column, so an uploaded picture is shrunk until it fits a small
 * budget (about 14,000 characters as a data address), which suits logos, icons and avatars. Photos should be a link to
 * a picture that is already online. Only png, jpeg, webp and gif are accepted; SVG is refused because it can carry script.
 */
export const IMAGE_BUDGET = 14000;
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const load = (file) =>
	new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('That file could not be read as a picture.'));
		};
		img.src = url;
	});

export async function shrinkImage(file, budget = IMAGE_BUDGET) {
	if (!TYPES.includes(file.type)) throw new Error('Use a png, jpeg, webp or gif picture (svg is not allowed).');
	return shrinkBlob(file, budget);
}

/** Shrinks a picture (a File or Blob of an allowed type) to a data address within `budget` characters, or throws. */
export async function shrinkBlob(file, budget = IMAGE_BUDGET) {
	const img = await load(file);
	const hasAlpha = file.type !== 'image/jpeg';
	for (const dim of [360, 280, 220, 170, 130, 96]) {
		const k = Math.min(dim / img.naturalWidth, dim / img.naturalHeight, 1);
		const w = Math.max(1, Math.round(img.naturalWidth * k));
		const h = Math.max(1, Math.round(img.naturalHeight * k));
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('This browser cannot resize pictures. Paste a link instead.');
		ctx.drawImage(img, 0, 0, w, h);
		for (const q of [0.82, 0.65, 0.5]) {
			const out = hasAlpha ? canvas.toDataURL('image/webp', q) : canvas.toDataURL('image/jpeg', q);
			if (/^data:image\/(png|jpeg|webp|gif);base64,/.test(out) && out.length <= budget) return out;
		}
	}
	throw new Error('That picture is too detailed to store inside a slide. Use a link to a picture that is already online, or a simpler image.');
}
