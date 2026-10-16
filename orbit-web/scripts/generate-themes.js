// Usage: npm run gen:themes
// Derives the extra themes (22 dark and light palettes) from a few seed colors each, and checks every
// pair against the same WCAG rules src/tests/themes.test.js enforces (colors are nudged until they pass).
// Writes src/styles/themes.extra.css, src/config/extraThemes.json and the id list in public/index.html.
// The seven original themes stay hand-written in src/styles/themes.css. Run `npm run gen:login-css` afterwards.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ---- seeds: id, name, one-line description, scheme, and four colors (page, panel, text, accent) ----
const SEEDS = [
	// dark
	['midnight', 'Midnight', 'Deep navy with a bright periwinkle accent', 'dark', '#070b16', '#0e1426', '#e6ebff', '#6c8cff'],
	['nord', 'Nord', 'Arctic blue-grey with frost cyan', 'dark', '#242933', '#2e3440', '#eceff4', '#88c0d0'],
	['dracula', 'Dracula', 'Classic purple night with a lilac accent', 'dark', '#1b1c26', '#282a36', '#f8f8f2', '#bd93f9'],
	['tokyo', 'Tokyo Night', 'Ink blue city night with a soft azure accent', 'dark', '#14141c', '#1a1b26', '#c0caf5', '#7aa2f7'],
	['graphite', 'Graphite', 'Neutral monochrome greys, no colour noise', 'dark', '#0f0f10', '#181819', '#ededed', '#d4d4d8'],
	['cyber', 'Cyberpunk', 'Neon magenta over an ultraviolet black', 'dark', '#0b0614', '#140b24', '#f3e9ff', '#ff3bd9'],
	['aurora', 'Aurora', 'Polar night green with a mint glow', 'dark', '#06130f', '#0c1f19', '#e3fff4', '#2ee6a6'],
	['mocha', 'Mocha', 'Roasted brown with a caramel accent', 'dark', '#14100d', '#1e1814', '#f1e6dc', '#d9a066'],
	['rosewood', 'Rosewood', 'Dark wine surfaces with a rose accent', 'dark', '#150a0d', '#201015', '#ffe8ee', '#ff6b8b'],
	['deepsea', 'Deep Sea', 'Abyssal teal with a cyan highlight', 'dark', '#04131a', '#0a1f29', '#dff6ff', '#22c3e6'],
	['obsidian', 'Obsidian Gold', 'Volcanic glass black with champagne gold', 'dark', '#0b0b0a', '#151513', '#f5f0e1', '#e0b341'],
	// light
	['paper', 'Paper', 'Warm off-white paper with terracotta ink', 'light', '#f6f3ec', '#fffdf8', '#1f1b16', '#b4531f'],
	['mint', 'Mint', 'Fresh pale green with a confident emerald', 'light', '#eef8f3', '#ffffff', '#10231b', '#0f8a5f'],
	['lavender', 'Lavender', 'Soft lilac whites with a rich violet', 'light', '#f4f0fb', '#ffffff', '#211a33', '#6d4bd1'],
	['rose', 'Rose Quartz', 'Blush surfaces with a raspberry accent', 'light', '#fbf0f3', '#ffffff', '#2b141b', '#c2335b'],
	['sand', 'Sand Dune', 'Desert beige with burnt sienna', 'light', '#f4ede2', '#fffaf1', '#2a2118', '#a8612a'],
	['sky', 'Sky', 'Open sky blue with a clear azure accent', 'light', '#eef6fd', '#ffffff', '#0f2236', '#1479d1'],
	['citrus', 'Citrus', 'Pale lime cream with an olive green accent', 'light', '#f8f7e8', '#fffff6', '#25260f', '#5c7a05'],
	['peach', 'Peach', 'Warm peach whites with a coral accent', 'light', '#fdf1ea', '#ffffff', '#301a10', '#d1561f'],
	['slate', 'Slate Light', 'Cool grey-blue office light with steel blue', 'light', '#eef1f5', '#ffffff', '#151b25', '#3b5b8a'],
	['teal', 'Teal Light', 'Clean aqua-tinted white with deep teal', 'light', '#ecf7f7', '#ffffff', '#0d2323', '#0b7f86'],
	['solar', 'Solar Light', 'Parchment cream with a calm cobalt accent', 'light', '#fdf6e3', '#fffbea', '#3b4a50', '#268bd2'],
];

// ---- colour helpers -------------------------------------------------------------------------------
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => {
	const x = hex2rgb(a);
	const y = hex2rgb(b);
	return rgb2hex(x.map((v, i) => v + (y[i] - v) * t));
};
const lum = (h) => {
	const c = hex2rgb(h).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
	const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
};
/** Nudge `fg` toward `toward` until it reaches `min` contrast against every colour in `bgs`. */
function ensure(fg, bgs, min, toward) {
	let c = fg;
	for (let i = 0; i < 60 && bgs.some((b) => contrast(c, b) < min); i++) c = mix(c, toward, 0.06);
	return c;
}
const rgbTriplet = (h) => hex2rgb(h).join(' ');

// ---- derive one theme -----------------------------------------------------------------------------
function derive([id, label, description, scheme, bg, surface, text, accentSeed]) {
	const dark = scheme === 'dark';
	const white = '#ffffff';
	const black = '#000000';
	const pull = dark ? white : black; // direction that raises contrast with the surfaces
	const t = { bg, surface, text };
	t['surface-2'] = mix(surface, text, dark ? 0.07 : 0.045);
	t['surface-3'] = mix(surface, text, dark ? 0.13 : 0.09);
	t.border = mix(surface, text, dark ? 0.15 : 0.12);
	t['border-strong'] = mix(surface, text, dark ? 0.3 : 0.28);
	const surfaces = [bg, surface, t['surface-2']];
	t['text-muted'] = ensure(mix(text, bg, 0.36), surfaces, 4.7, text);
	t.text = ensure(text, surfaces, 7, pull);

	// accent: readable as text/icon on the surface and on its own soft tint
	let accent = accentSeed;
	let soft;
	for (let i = 0; i < 40; i++) {
		soft = mix(surface, accent, dark ? 0.2 : 0.13);
		if (contrast(accent, surface) >= 4.6 && contrast(accent, soft) >= 4.6 && contrast(accent, bg) >= 4.6) break;
		accent = mix(accent, pull, 0.06);
	}
	t.accent = accent;
	t['accent-soft'] = soft;
	t['accent-hover'] = mix(accent, dark ? white : black, 0.14);
	const ink = dark ? '#10101a' : '#ffffff';
	const altInk = dark ? '#ffffff' : '#10101a';
	t['accent-contrast'] = [ink, altInk].find((c) => contrast(c, accent) >= 4.5 && contrast(c, t['accent-hover']) >= 4.5) || ink;
	if (contrast(t['accent-contrast'], accent) < 4.5 || contrast(t['accent-contrast'], t['accent-hover']) < 4.5) {
		// pull the accent apart from the ink until both states pass
		let a = accent;
		for (let i = 0; i < 40 && (contrast(ink, a) < 4.5 || contrast(ink, mix(a, dark ? white : black, 0.14)) < 4.5); i++) a = mix(a, dark ? white : black, 0.05);
		t.accent = a;
		t['accent-hover'] = mix(a, dark ? white : black, 0.14);
		t['accent-contrast'] = ink;
		t['accent-soft'] = mix(surface, a, dark ? 0.2 : 0.13);
		t.accent = ensure(t.accent, [surface, t['accent-soft'], bg], 4.5, pull);
	}
	t['on-accent'] = t['accent-contrast'];
	t.focus = ensure(t.accent, [surface, bg], 3, pull);

	// status colours (text on their own soft tint and on the surface)
	const base = dark
		? { success: '#5fd392', warning: '#f0b95a', danger: '#ff8d85', info: '#7fb6f2' }
		: { success: '#19703f', warning: '#8a5300', danger: '#b3261e', info: '#1c5c93' };
	for (const [k, v] of Object.entries(base)) {
		const s = mix(surface, v, dark ? 0.16 : 0.12);
		t[k] = ensure(v, [s, surface], 4.6, pull);
		t[`${k}-soft`] = s;
	}
	// charts: the accent first, then a spread of hues, each at least 3:1 against the surface
	const hues = dark ? ['#f0a24a', '#4fcfb9', '#f27a98', '#7cb4f5', '#9ca3b5'] : ['#c2680f', '#14907e', '#8a4fc4', '#d4476a', '#66749a'];
	[t.accent, ...hues].forEach((c, i) => {
		t[`chart-${i + 1}`] = ensure(c, [surface], 3.1, pull);
	});
	t['chart-grid'] = mix(surface, text, dark ? 0.1 : 0.08);
	t.scrollbar = t['border-strong'];
	return { id, label, description, scheme, t };
}

const themes = SEEDS.map(derive);

// ---- verify with the exact rules of the test suite -------------------------------------------------
const problems = [];
for (const { id, t } of themes) {
	const chk = (name, a, b, min) => contrast(a, b) < min && problems.push(`${id}: ${name} ${contrast(a, b).toFixed(2)} < ${min}`);
	for (const s of ['bg', 'surface', 'surface-2']) {
		chk(`text/${s}`, t.text, t[s], 4.5);
		chk(`muted/${s}`, t['text-muted'], t[s], 4.5);
	}
	chk('accent/surface', t.accent, t.surface, 4.5);
	chk('accent/soft', t.accent, t['accent-soft'], 4.5);
	chk('contrast/accent', t['accent-contrast'], t.accent, 4.5);
	chk('contrast/hover', t['accent-contrast'], t['accent-hover'], 4.5);
	for (const s of ['success', 'warning', 'danger', 'info']) {
		chk(s + '/soft', t[s], t[`${s}-soft`], 4.5);
		chk(s + '/surface', t[s], t.surface, 4.5);
	}
	for (let i = 1; i <= 6; i++) chk(`chart-${i}`, t[`chart-${i}`], t.surface, 3);
	chk('focus/surface', t.focus, t.surface, 3);
	chk('focus/bg', t.focus, t.bg, 3);
}
if (problems.length) {
	console.error('Palette problems:\n' + problems.join('\n'));
	process.exit(1);
}

// ---- write css ---------------------------------------------------------------------------------------
const ORDER = ['bg', 'surface', 'surface-2', 'surface-3', 'border', 'border-strong', 'text', 'text-muted', 'on-accent', 'accent', 'accent-hover', 'accent-contrast', 'accent-soft', 'focus'];
const block = ({ id, label, scheme, t }) => {
	const dark = scheme === 'dark';
	const lines = ORDER.map((k) => `\t--${k}: ${t[k]};`);
	lines.splice(ORDER.indexOf('focus') + 1, 0, `\t--ring: rgb(${rgbTriplet(t.accent)} / ${dark ? 0.3 : 0.22});`);
	for (const s of ['success', 'warning', 'danger', 'info']) lines.push(`\t--${s}: ${t[s]};`, `\t--${s}-soft: ${t[`${s}-soft`]};`);
	for (let i = 1; i <= 6; i++) lines.push(`\t--chart-${i}: ${t[`chart-${i}`]};`);
	lines.push(`\t--chart-grid: ${t['chart-grid']};`);
	lines.push(`\t--header-bg: rgb(${rgbTriplet(t.surface)} / 0.82);`);
	lines.push(`\t--gradient-accent: linear-gradient(135deg, ${t.accent} 0%, ${mix(t.accent, dark ? '#ffffff' : '#000000', 0.28)} 100%);`);
	lines.push(`\t--gradient-wash: radial-gradient(900px 420px at 85% -10%, rgb(${rgbTriplet(t.accent)} / ${dark ? 0.16 : 0.12}), transparent 70%);`);
	lines.push(`\t--scrollbar: ${t.scrollbar};`);
	lines.push(`\t--shadow-rgb: ${dark ? '0 0 0' : rgbTriplet(mix(t.text, t.bg, 0.55))};`);
	return `/* ============ ${label} (${scheme}) ============ */\n[data-theme='${id}'] {\n\tcolor-scheme: ${scheme};\n${lines.join('\n')}\n}\n`;
};
const css = `/*
 * Extra themes. GENERATED by scripts/generate-themes.js from a few seed colours each; do not edit by hand
 * (change the seeds and run \`npm run gen:themes\`). Same token contract as themes.css; every pair is checked
 * for WCAG AA there and again by src/tests/themes.test.js.
 */

${themes.map(block).join('\n')}
/* the native date picker icon is dark by default: flip it on the dark palettes */
${themes
	.filter((x) => x.scheme === 'dark')
	.map((x) => `html[data-theme='${x.id}'] .field input[type='date']::-webkit-calendar-picker-indicator`)
	.join(',\n')} {
	filter: invert(1);
}
`;
fs.writeFileSync(path.join(ROOT, 'src/styles/themes.extra.css'), css);

fs.writeFileSync(
	path.join(ROOT, 'src/config/extraThemes.json'),
	JSON.stringify(
		themes.map(({ id, label, description, scheme, t }) => ({ id, label, description, scheme, swatch: [t.bg, t.surface, t.accent] })),
		null,
		'\t'
	) + '\n'
);

// ---- keep the pre-paint list in public/index.html in step ---------------------------------------------
const core = ['ember', 'blueberry', 'blackcurrant', 'volcano', 'sunset', 'ocean', 'forest'];
const all = [...core, ...themes.map((x) => x.id), 'system'];
const htmlPath = path.join(ROOT, 'public/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const re = /if \(\[('ember'[^\]]*)\]\.indexOf\(t\) > -1\) theme = t;/;
if (!re.test(html)) throw new Error('could not find the theme id list in public/index.html');
html = html.replace(re, `if ([${all.map((i) => `'${i}'`).join(', ')}].indexOf(t) > -1) theme = t;`);
fs.writeFileSync(htmlPath, html);

console.log(`wrote ${themes.length} themes (${themes.filter((x) => x.scheme === 'dark').length} dark, ${themes.filter((x) => x.scheme === 'light').length} light)`);
