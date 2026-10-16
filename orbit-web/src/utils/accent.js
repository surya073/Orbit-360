// Custom accent colour: derives the accent token family from one colour the user picks, for whichever theme is
// active, and keeps every pair readable (same AA rules as the built-in themes; see tests/themes.test.js).
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a, b, t) => {
	const x = hex2rgb(a);
	const y = hex2rgb(b);
	return rgb2hex(x.map((v, i) => v + (y[i] - v) * t));
};
export const luminance = (h) => {
	const c = hex2rgb(h)
		.map((v) => v / 255)
		.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contrast = (a, b) => {
	const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
};
export const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

/** The custom properties that a custom accent overrides (removed again when the accent is cleared). */
export const ACCENT_VARS = ['--accent', '--accent-hover', '--accent-contrast', '--on-accent', '--accent-soft', '--focus', '--ring', '--gradient-accent', '--chart-1'];

/** accentVars('#ff6600', { surface, bg }) -> { '--accent': ..., ... } adjusted for the theme's own surfaces. */
export function accentVars(hex, { surface, bg }) {
	const dark = luminance(surface) < 0.2;
	const pull = dark ? '#ffffff' : '#000000';
	let accent = hex.toLowerCase();
	let soft = mix(surface, accent, dark ? 0.2 : 0.13);
	for (let i = 0; i < 40; i++) {
		soft = mix(surface, accent, dark ? 0.2 : 0.13);
		if (contrast(accent, surface) >= 4.6 && contrast(accent, soft) >= 4.6 && contrast(accent, bg) >= 4.6) break;
		accent = mix(accent, pull, 0.06);
	}
	const ink = dark ? '#10101a' : '#ffffff';
	const hoverOf = (a) => mix(a, pull, 0.14);
	let hover = hoverOf(accent);
	let onAccent = ink;
	if (contrast(ink, accent) < 4.5 || contrast(ink, hover) < 4.5) {
		// the chosen colour is too close to the ink: use the opposite ink, or move the accent away from it
		const alt = dark ? '#ffffff' : '#10101a';
		if (contrast(alt, accent) >= 4.5 && contrast(alt, hover) >= 4.5) onAccent = alt;
		else {
			for (let i = 0; i < 40 && (contrast(ink, accent) < 4.5 || contrast(ink, hoverOf(accent)) < 4.5); i++) accent = mix(accent, pull, 0.05);
			hover = hoverOf(accent);
			soft = mix(surface, accent, dark ? 0.2 : 0.13);
		}
	}
	let focus = accent;
	for (let i = 0; i < 40 && (contrast(focus, surface) < 3 || contrast(focus, bg) < 3); i++) focus = mix(focus, pull, 0.06);
	const [r, g, b] = hex2rgb(accent);
	return {
		'--accent': accent,
		'--accent-hover': hover,
		'--accent-contrast': onAccent,
		'--on-accent': onAccent,
		'--accent-soft': soft,
		'--focus': focus,
		'--ring': `rgb(${r} ${g} ${b} / ${dark ? 0.3 : 0.22})`,
		'--gradient-accent': `linear-gradient(135deg, ${accent} 0%, ${mix(accent, pull, 0.28)} 100%)`,
		'--chart-1': accent,
	};
}
