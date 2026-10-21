/**
 * Presentation themes. Each theme is a complete token set: it re-declares the application's own
 * colour tokens (so every existing dashboard widget, chart and KPI card that appears on a slide
 * adopts the theme automatically) plus presentation-only tokens for backgrounds, glass cards,
 * gradients and glows. Tokens are applied as inline CSS variables on a `.pscope` element by
 * `themeStyle()`, so the launcher previews, the landing page and the viewer all use the exact same
 * values. Decorative, theme-specific shapes (rings, hairline frames, diagonal blocks...) live in
 * presentations.css under `[data-ptheme='<id>']`.
 *
 * Colour pairs are checked for WCAG AA contrast in tests/presentationCenter.test.js.
 */

const STATUS_DARK = {
	'--success': '#5be08e',
	'--success-soft': '#0f3a24',
	'--warning': '#ffc857',
	'--warning-soft': '#3d2f0b',
	'--danger': '#ff8f86',
	'--danger-soft': '#4a1a1a',
	'--info': '#7cc7ff',
	'--info-soft': '#0f2f4d',
};
const STATUS_LIGHT = {
	'--success': '#17703f',
	'--success-soft': '#dff3e7',
	'--warning': '#8a5300',
	'--warning-soft': '#fdf0d5',
	'--danger': '#b3261e',
	'--danger-soft': '#fbe6e4',
	'--info': '#1c5c93',
	'--info-soft': '#e1edf9',
};

const CORE_THEMES = [
	{
		id: 'aurora',
		name: 'Aurora Executive',
		tagline: 'Premium corporate · Blue, violet and cyan',
		description: 'Deep midnight blue with violet gradients, cyan highlights and soft luminous glass panels.',
		dark: true,
		swatches: ['#070b24', '#5b6bff', '#8b5cf6', '#4dd6ff'],
		tokens: {
			'color-scheme': 'dark',
			'--bg': '#070b24',
			'--surface': '#111850',
			'--surface-2': '#18216b',
			'--surface-3': '#232f8a',
			'--border': '#2c3a9c',
			'--border-strong': '#4a5ccd',
			'--text': '#f1f3ff',
			'--text-muted': '#b4bdf0',
			'--on-accent': '#04112e',
			'--accent': '#4dd6ff',
			'--accent-hover': '#8be6ff',
			'--accent-contrast': '#04112e',
			'--accent-soft': '#16306e',
			'--focus': '#8be6ff',
			'--ring': 'rgb(77 214 255 / 0.35)',
			...STATUS_DARK,
			'--chart-1': '#4dd6ff',
			'--chart-2': '#9b8bff',
			'--chart-3': '#5b8cff',
			'--chart-4': '#d38bff',
			'--chart-5': '#2dd4bf',
			'--chart-6': '#f0abfc',
			'--chart-grid': '#2a3690',
			'--scrollbar': '#4a5ccd',
			'--shadow-rgb': '2 6 40',
			'--gradient-accent': 'linear-gradient(135deg, #5b6bff 0%, #4dd6ff 100%)',
			'--gradient-wash': 'radial-gradient(900px 420px at 85% -10%, rgb(139 92 246 / 0.25), transparent 70%)',
			'--p-bg': 'radial-gradient(1200px 700px at 12% -10%, #2a2f9e 0%, transparent 60%), radial-gradient(1000px 640px at 100% 110%, #5b2fb5 0%, transparent 55%), linear-gradient(160deg, #0a1033 0%, #070b24 70%)',
			'--p-letterbox': '#04071a',
			'--p-card': 'linear-gradient(160deg, rgb(255 255 255 / 0.09), rgb(255 255 255 / 0.03))',
			'--p-card-border': 'rgb(150 170 255 / 0.28)',
			'--p-kpi-bg': 'linear-gradient(150deg, rgb(91 107 255 / 0.28), rgb(77 214 255 / 0.08))',
			'--p-title-gradient': 'linear-gradient(100deg, #ffffff 10%, #a9e9ff 55%, #c7b8ff 100%)',
			'--p-glow': '77 214 255',
			'--p-font-display': "'Manrope Variable', 'Manrope', system-ui, sans-serif",
			'--p-heading-weight': '800',
		},
	},
	{
		id: 'obsidian',
		name: 'Obsidian Luxe',
		tagline: 'Luxury executive · Black, graphite and gold',
		description: 'Black and graphite surfaces with restrained gold, thin hairline borders and a refined serif voice.',
		dark: true,
		swatches: ['#0b0b0c', '#2c2c31', '#d4af37', '#f5f1e8'],
		tokens: {
			'color-scheme': 'dark',
			'--bg': '#0b0b0c',
			'--surface': '#17171a',
			'--surface-2': '#202024',
			'--surface-3': '#2c2c31',
			'--border': '#34343a',
			'--border-strong': '#5a5a63',
			'--text': '#f6f2e9',
			'--text-muted': '#bdb6a6',
			'--on-accent': '#15110a',
			'--accent': '#d9b445',
			'--accent-hover': '#ebcb6a',
			'--accent-contrast': '#15110a',
			'--accent-soft': '#2c2512',
			'--focus': '#ebcb6a',
			'--ring': 'rgb(217 180 69 / 0.35)',
			...STATUS_DARK,
			'--chart-1': '#d9b445',
			'--chart-2': '#cfcabd',
			'--chart-3': '#c98a58',
			'--chart-4': '#8fa8c2',
			'--chart-5': '#a3c796',
			'--chart-6': '#c9788a',
			'--chart-grid': '#34343a',
			'--scrollbar': '#5a5a63',
			'--shadow-rgb': '0 0 0',
			'--gradient-accent': 'linear-gradient(135deg, #b8902a 0%, #f0d27a 55%, #c9a13c 100%)',
			'--gradient-wash': 'radial-gradient(900px 420px at 85% -10%, rgb(217 180 69 / 0.12), transparent 70%)',
			'--p-bg': 'radial-gradient(900px 520px at 80% -20%, #2a2418 0%, transparent 60%), linear-gradient(180deg, #131315 0%, #0b0b0c 100%)',
			'--p-letterbox': '#050505',
			'--p-card': 'linear-gradient(180deg, #1c1c20, #141417)',
			'--p-card-border': 'rgb(217 180 69 / 0.32)',
			'--p-kpi-bg': 'linear-gradient(180deg, #1f1d17, #141417)',
			'--p-title-gradient': 'linear-gradient(100deg, #f8efd2 0%, #e5c565 50%, #bf9530 100%)',
			'--p-glow': '217 180 69',
			'--p-font-display': "Georgia, 'Times New Roman', 'Noto Serif', serif",
			'--p-heading-weight': '600',
		},
	},
	{
		id: 'crystal',
		name: 'Crystal Blue',
		tagline: 'Bright corporate · Ice blue, white and indigo',
		description: 'Clean white and ice-blue surfaces with indigo accents, built for projectors and large displays.',
		dark: false,
		swatches: ['#eef4ff', '#ffffff', '#3b4fd8', '#0ea5e9'],
		tokens: {
			'color-scheme': 'light',
			'--bg': '#eef4ff',
			'--surface': '#ffffff',
			'--surface-2': '#f0f5ff',
			'--surface-3': '#dfe9fc',
			'--border': '#d2ddf4',
			'--border-strong': '#a9bbe4',
			'--text': '#0f1b3d',
			'--text-muted': '#43517a',
			'--on-accent': '#ffffff',
			'--accent': '#3446d1',
			'--accent-hover': '#2837ad',
			'--accent-contrast': '#ffffff',
			'--accent-soft': '#e3e8fd',
			'--focus': '#3446d1',
			'--ring': 'rgb(52 70 209 / 0.25)',
			...STATUS_LIGHT,
			'--chart-1': '#3446d1',
			'--chart-2': '#0b86c4',
			'--chart-3': '#6d5bf0',
			'--chart-4': '#0f8f9e',
			'--chart-5': '#8a4fc4',
			'--chart-6': '#5c78b5',
			'--chart-grid': '#dde6f8',
			'--scrollbar': '#a9bbe4',
			'--shadow-rgb': '30 50 130',
			'--gradient-accent': 'linear-gradient(135deg, #3446d1 0%, #38a9f0 100%)',
			'--gradient-wash': 'radial-gradient(900px 420px at 85% -10%, rgb(56 169 240 / 0.18), transparent 70%)',
			'--p-bg': 'radial-gradient(1100px 620px at 100% -10%, #cfe0ff 0%, transparent 60%), radial-gradient(900px 560px at 0% 110%, #dfe3ff 0%, transparent 60%), linear-gradient(180deg, #f7faff 0%, #eaf1ff 100%)',
			'--p-letterbox': '#dbe6fb',
			'--p-card': 'linear-gradient(180deg, #ffffff, #f4f8ff)',
			'--p-card-border': 'rgb(120 145 215 / 0.35)',
			'--p-kpi-bg': 'linear-gradient(160deg, #ffffff 0%, #e6edff 100%)',
			'--p-title-gradient': 'linear-gradient(100deg, #1c2a8f 0%, #3446d1 50%, #1b8fd6 100%)',
			'--p-glow': '52 70 209',
			'--p-font-display': "'Manrope Variable', 'Manrope', system-ui, sans-serif",
			'--p-heading-weight': '800',
		},
	},
	{
		id: 'sunset',
		name: 'Sunset Prestige',
		tagline: 'Bold and expressive · Coral, orange and violet',
		description: 'Deep plum canvas lit by coral, orange and magenta gradients for energy and visual impact.',
		dark: true,
		swatches: ['#1d0b22', '#ff7a59', '#ffb347', '#c855d9'],
		tokens: {
			'color-scheme': 'dark',
			'--bg': '#1d0b22',
			'--surface': '#2e1535',
			'--surface-2': '#3b1b44',
			'--surface-3': '#4d2558',
			'--border': '#5e2e6a',
			'--border-strong': '#8a4797',
			'--text': '#fff5ef',
			'--text-muted': '#e8c4cf',
			'--on-accent': '#2a0a10',
			'--accent': '#ff8362',
			'--accent-hover': '#ffa088',
			'--accent-contrast': '#2a0a10',
			'--accent-soft': '#4d2036',
			'--focus': '#ffb59f',
			'--ring': 'rgb(255 131 98 / 0.35)',
			...STATUS_DARK,
			'--chart-1': '#ff8362',
			'--chart-2': '#ffb347',
			'--chart-3': '#d36bea',
			'--chart-4': '#ff6a9a',
			'--chart-5': '#9b82ff',
			'--chart-6': '#ffd36b',
			'--chart-grid': '#5e2e6a',
			'--scrollbar': '#8a4797',
			'--shadow-rgb': '20 4 24',
			'--gradient-accent': 'linear-gradient(135deg, #ff5e62 0%, #ff9966 55%, #c850c0 100%)',
			'--gradient-wash': 'radial-gradient(900px 420px at 85% -10%, rgb(255 131 98 / 0.22), transparent 70%)',
			'--p-bg': 'radial-gradient(1000px 640px at 105% -15%, #ff6a4a 0%, transparent 55%), radial-gradient(900px 620px at -5% 110%, #8f2fb5 0%, transparent 55%), linear-gradient(160deg, #2a0f31 0%, #1d0b22 75%)',
			'--p-letterbox': '#12061a',
			'--p-card': 'linear-gradient(160deg, rgb(255 255 255 / 0.1), rgb(255 255 255 / 0.03))',
			'--p-card-border': 'rgb(255 160 140 / 0.3)',
			'--p-kpi-bg': 'linear-gradient(145deg, rgb(255 94 98 / 0.35), rgb(200 80 192 / 0.2))',
			'--p-title-gradient': 'linear-gradient(100deg, #fff2e6 0%, #ffc09a 45%, #ff8ac0 100%)',
			'--p-glow': '255 131 98',
			'--p-font-display': "'Manrope Variable', 'Manrope', system-ui, sans-serif",
			'--p-heading-weight': '800',
		},
	},
	{
		id: 'emerald',
		name: 'Emerald Vision',
		tagline: 'Growth and performance · Emerald, teal and midnight',
		description: 'Midnight green with emerald and teal highlights, luminous borders and clean growth indicators.',
		dark: true,
		swatches: ['#04201c', '#0f6b5c', '#34d399', '#2dd4bf'],
		tokens: {
			'color-scheme': 'dark',
			'--bg': '#04201c',
			'--surface': '#0a322c',
			'--surface-2': '#0f4038',
			'--surface-3': '#16554a',
			'--border': '#1d6154',
			'--border-strong': '#2f8a79',
			'--text': '#eafff8',
			'--text-muted': '#a3dccb',
			'--on-accent': '#032119',
			'--accent': '#38d9a0',
			'--accent-hover': '#7beccb',
			'--accent-contrast': '#032119',
			'--accent-soft': '#0f4e3f',
			'--focus': '#7beccb',
			'--ring': 'rgb(56 217 160 / 0.35)',
			...STATUS_DARK,
			'--chart-1': '#38d9a0',
			'--chart-2': '#2dd4e0',
			'--chart-3': '#a8e63d',
			'--chart-4': '#4cb8ff',
			'--chart-5': '#ffcf4d',
			'--chart-6': '#8ff0b8',
			'--chart-grid': '#1d6154',
			'--scrollbar': '#2f8a79',
			'--shadow-rgb': '0 14 12',
			'--gradient-accent': 'linear-gradient(135deg, #10b981 0%, #2dd4bf 55%, #38bdf8 100%)',
			'--gradient-wash': 'radial-gradient(900px 420px at 85% -10%, rgb(56 217 160 / 0.2), transparent 70%)',
			'--p-bg': 'radial-gradient(1000px 640px at 100% -10%, #0f8a6c 0%, transparent 55%), radial-gradient(900px 600px at -5% 110%, #0b5f66 0%, transparent 55%), linear-gradient(165deg, #06302a 0%, #04201c 75%)',
			'--p-letterbox': '#021411',
			'--p-card': 'linear-gradient(160deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.02))',
			'--p-card-border': 'rgb(80 230 190 / 0.3)',
			'--p-kpi-bg': 'linear-gradient(150deg, rgb(16 185 129 / 0.3), rgb(45 212 191 / 0.08))',
			'--p-title-gradient': 'linear-gradient(100deg, #f0fff9 0%, #8ff0cf 50%, #55d6f0 100%)',
			'--p-glow': '56 217 160',
			'--p-font-display': "'Manrope Variable', 'Manrope', system-ui, sans-serif",
			'--p-heading-weight': '800',
		},
	},
];

/** Builds a theme from a compact palette so the five templates below stay readable. */
function make({ id, name, tagline, description, dark, swatches, motion, c }) {
	return {
		id,
		name,
		tagline,
		description,
		dark,
		swatches,
		motion,
		tokens: {
			'color-scheme': dark ? 'dark' : 'light',
			'--bg': c.bg,
			'--surface': c.surface,
			'--surface-2': c.surface2,
			'--surface-3': c.surface3,
			'--border': c.border,
			'--border-strong': c.strong,
			'--text': c.text,
			'--text-muted': c.muted,
			'--on-accent': c.onAccent,
			'--accent': c.accent,
			'--accent-hover': c.hover,
			'--accent-contrast': c.onAccent,
			'--accent-soft': c.soft,
			'--focus': c.hover,
			'--ring': `rgb(${c.glow} / 0.35)`,
			...(dark ? STATUS_DARK : STATUS_LIGHT),
			'--chart-1': c.charts[0],
			'--chart-2': c.charts[1],
			'--chart-3': c.charts[2],
			'--chart-4': c.charts[3],
			'--chart-5': c.charts[4],
			'--chart-6': c.charts[5],
			'--chart-grid': c.grid,
			'--scrollbar': c.strong,
			'--shadow-rgb': dark ? '0 0 0' : '40 36 30',
			'--gradient-accent': c.gradient,
			'--gradient-wash': `radial-gradient(900px 420px at 85% -10%, rgb(${c.glow} / 0.18), transparent 70%)`,
			'--p-bg': c.pBg,
			'--p-letterbox': c.letterbox,
			'--p-card': c.card,
			'--p-card-border': c.cardBorder,
			'--p-kpi-bg': c.kpi,
			'--p-title-gradient': c.title,
			'--p-glow': c.glow,
			'--p-font-display': c.font,
			'--p-heading-weight': c.weight,
		},
	};
}

// Five more templates, in the spirit of the styles that presentation galleries favour: an editorial paper look, a
// startup pitch deck, a neon poster, a calm natural palette and a classic corporate navy. Every one is checked for
// WCAG AA contrast by tests/presentationCenter.test.js, like the first five.
const NEW_THEMES = [
	make({
		id: 'editorial',
		name: 'Modern Editorial',
		tagline: 'Magazine style · Cream paper, ink black and signal red',
		description: 'Warm paper, a confident serif and one red accent: reads like a printed annual report.',
		dark: false,
		motion: 'flip',
		swatches: ['#f6f1e7', '#1b1713', '#c8102e', '#b7791f'],
		c: { bg: '#f6f1e7', surface: '#fffaf0', surface2: '#efe7d6', surface3: '#e4d9c2', border: '#d8ccb3', strong: '#b8a98a', text: '#1b1713', muted: '#5b5245', accent: '#c8102e', hover: '#e0243f', onAccent: '#ffffff', soft: '#fbe3df', glow: '200 16 46', charts: ['#c8102e', '#1f4e79', '#b7791f', '#2f7a55', '#6b3fa0', '#555555'], grid: '#d8ccb3', gradient: 'linear-gradient(135deg, #c8102e 0%, #e8553f 100%)', pBg: 'radial-gradient(900px 520px at 100% 0%, #fde7c8 0%, transparent 60%), linear-gradient(180deg, #f8f3e9 0%, #f1e9d7 100%)', letterbox: '#e7dfcb', card: 'linear-gradient(160deg, rgb(255 255 255 / 0.9), rgb(255 250 240 / 0.75))', cardBorder: 'rgb(27 23 19 / 0.16)', kpi: 'linear-gradient(150deg, rgb(200 16 46 / 0.12), rgb(255 250 240 / 0.7))', title: 'linear-gradient(100deg, #1b1713 0%, #7a1020 60%, #c8102e 100%)', font: "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif", weight: '700' },
	}),
	make({
		id: 'pitch',
		name: 'Startup Pitch',
		tagline: 'Pitch deck · Ink black, indigo glow and electric lime',
		description: 'High-contrast and fast: dark indigo with a lime accent, made for the numbers you want people to remember.',
		dark: true,
		motion: 'slide',
		swatches: ['#0a0a14', '#7c5cff', '#c6ff3d', '#33d6ff'],
		c: { bg: '#0a0a14', surface: '#13131f', surface2: '#1c1c2c', surface3: '#26263a', border: '#2f2f48', strong: '#4b4b72', text: '#f5f5ff', muted: '#b3b3d1', accent: '#c6ff3d', hover: '#d9ff7a', onAccent: '#0b1200', soft: '#2a3410', glow: '198 255 61', charts: ['#c6ff3d', '#7c5cff', '#33d6ff', '#ff5ca8', '#ffb347', '#3ddc97'], grid: '#2b2b44', gradient: 'linear-gradient(135deg, #7c5cff 0%, #c6ff3d 100%)', pBg: 'radial-gradient(900px 600px at 0% 0%, #2b1d6e 0%, transparent 60%), radial-gradient(800px 500px at 100% 100%, #123a2a 0%, transparent 55%), linear-gradient(160deg, #0d0d1c 0%, #0a0a14 100%)', letterbox: '#05050c', card: 'linear-gradient(160deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.02))', cardBorder: 'rgb(198 255 61 / 0.25)', kpi: 'linear-gradient(150deg, rgb(124 92 255 / 0.32), rgb(198 255 61 / 0.08))', title: 'linear-gradient(100deg, #ffffff 10%, #e7ffa6 55%, #c6ff3d 100%)', font: "'Space Grotesk', 'Manrope Variable', 'Manrope', system-ui, sans-serif", weight: '800' },
	}),
	make({
		id: 'neon',
		name: 'Neon Poster',
		tagline: 'Bold and loud · Midnight violet, hot pink and cyan',
		description: 'Glowing gradients and a poster-style frame: for launches, campaigns and creative reviews.',
		dark: true,
		motion: 'zoom',
		swatches: ['#0d0615', '#7a1fa8', '#ff3cc7', '#2ee6ff'],
		c: { bg: '#0d0615', surface: '#170b24', surface2: '#220f35', surface3: '#2f1648', border: '#46206b', strong: '#7a35b8', text: '#fff0fb', muted: '#d9b8e6', accent: '#ff3cc7', hover: '#ff7ad8', onAccent: '#1a0016', soft: '#2f0a2c', glow: '255 60 199', charts: ['#ff3cc7', '#2ee6ff', '#b6ff4d', '#ffb52e', '#9b7bff', '#ff6b6b'], grid: '#3a1a58', gradient: 'linear-gradient(135deg, #ff3cc7 0%, #9b7bff 55%, #2ee6ff 100%)', pBg: 'radial-gradient(900px 560px at 85% -5%, #7a1fa8 0%, transparent 55%), radial-gradient(800px 500px at 0% 105%, #0a5a78 0%, transparent 55%), linear-gradient(160deg, #16082a 0%, #0d0615 100%)', letterbox: '#070310', card: 'linear-gradient(160deg, rgb(255 255 255 / 0.09), rgb(255 255 255 / 0.02))', cardBorder: 'rgb(255 60 199 / 0.35)', kpi: 'linear-gradient(150deg, rgb(255 60 199 / 0.3), rgb(46 230 255 / 0.1))', title: 'linear-gradient(100deg, #ffffff 5%, #ffb3ec 45%, #7df0ff 100%)', font: "'Trebuchet MS', 'Manrope Variable', 'Manrope', system-ui, sans-serif", weight: '900' },
	}),
	make({
		id: 'sage',
		name: 'Calm Sage',
		tagline: 'Natural and calm · Sage green, cream and clay',
		description: 'Soft greens and a clay highlight on warm white: relaxed, readable and good for people-focused reviews.',
		dark: false,
		motion: 'rise',
		swatches: ['#eef3ea', '#2f6b3f', '#c2692f', '#3a7ca5'],
		c: { bg: '#eef3ea', surface: '#fbfdf9', surface2: '#e3ecdd', surface3: '#d5e2cc', border: '#c5d6b9', strong: '#9db58b', text: '#1c2a1e', muted: '#4a5d4c', accent: '#2f6b3f', hover: '#255532', onAccent: '#ffffff', soft: '#d6e8d2', glow: '47 107 63', charts: ['#2f6b3f', '#c2692f', '#3a7ca5', '#8a5a9e', '#b8860b', '#5b6b5d'], grid: '#c5d6b9', gradient: 'linear-gradient(135deg, #2f6b3f 0%, #5f9b6a 100%)', pBg: 'radial-gradient(900px 560px at 100% 0%, #d4e6cd 0%, transparent 60%), radial-gradient(700px 500px at 0% 100%, #f3ead2 0%, transparent 55%), linear-gradient(170deg, #f3f7ef 0%, #e8f0e2 100%)', letterbox: '#dde8d6', card: 'linear-gradient(160deg, rgb(255 255 255 / 0.9), rgb(246 251 243 / 0.75))', cardBorder: 'rgb(47 107 63 / 0.22)', kpi: 'linear-gradient(150deg, rgb(47 107 63 / 0.14), rgb(255 255 255 / 0.6))', title: 'linear-gradient(100deg, #1c2a1e 0%, #2f6b3f 60%, #5f9b6a 100%)', font: "'Avenir Next', 'Manrope Variable', 'Manrope', system-ui, sans-serif", weight: '700' },
	}),
	make({
		id: 'corporate',
		name: 'Corporate Navy',
		tagline: 'Classic business · White, navy and a bright blue lift',
		description: 'The safe, familiar boardroom look: white space, deep navy type and a restrained blue accent.',
		dark: false,
		motion: 'wipe',
		swatches: ['#f4f6fa', '#0b3d91', '#1e66d0', '#f2711c'],
		c: { bg: '#f4f6fa', surface: '#ffffff', surface2: '#e8edf5', surface3: '#d9e1ee', border: '#cdd6e6', strong: '#9fb0cc', text: '#0e1b33', muted: '#4a5a78', accent: '#0b3d91', hover: '#082f70', onAccent: '#ffffff', soft: '#dbe6fb', glow: '11 61 145', charts: ['#0b3d91', '#c2410c', '#0f766e', '#7a4fb5', '#2e7d32', '#64748b'], grid: '#cdd6e6', gradient: 'linear-gradient(135deg, #0b3d91 0%, #1e66d0 100%)', pBg: 'radial-gradient(1000px 600px at 100% 0%, #dbe6fb 0%, transparent 60%), linear-gradient(180deg, #f7f9fc 0%, #eef2f9 100%)', letterbox: '#e3e9f3', card: 'linear-gradient(160deg, rgb(255 255 255 / 0.95), rgb(244 247 252 / 0.8))', cardBorder: 'rgb(11 61 145 / 0.2)', kpi: 'linear-gradient(150deg, rgb(11 61 145 / 0.12), rgb(255 255 255 / 0.7))', title: 'linear-gradient(100deg, #0b2a66 0%, #0b3d91 55%, #1e66d0 100%)', font: "'Manrope Variable', 'Manrope', system-ui, sans-serif", weight: '800' },
	}),
];

// The transition each of the first five opens with (the viewer can still pick another one in the player).
const OPENING_MOTION = { aurora: 'slide', obsidian: 'blur', crystal: 'zoom', sunset: 'wipe', emerald: 'rise' };
export const PRESENTATION_THEMES = [...CORE_THEMES, ...NEW_THEMES].map((t) => ({ ...t, motion: t.motion || OPENING_MOTION[t.id] || 'slide' }));

/** Slide transitions the player can use (CSS in presentations.css). 'auto' means the theme's own. */
export const TRANSITIONS = [
	{ id: 'auto', label: 'Theme default' },
	{ id: 'slide', label: 'Slide' },
	{ id: 'zoom', label: 'Zoom' },
	{ id: 'blur', label: 'Dissolve' },
	{ id: 'flip', label: 'Flip' },
	{ id: 'wipe', label: 'Wipe' },
	{ id: 'rise', label: 'Rise' },
];
const TRANSITION_KEY = 'company360.presentationTransition';
export function readStoredTransition() {
	try {
		const v = window.localStorage.getItem(TRANSITION_KEY);
		return TRANSITIONS.some((t) => t.id === v) ? v : 'auto';
	} catch {
		return 'auto';
	}
}
export function storeTransition(id) {
	try {
		if (TRANSITIONS.some((t) => t.id === id)) window.localStorage.setItem(TRANSITION_KEY, id);
	} catch {
		/* not remembered */
	}
}

export const DEFAULT_PRESENTATION_THEME = 'aurora';
export const THEME_IDS = PRESENTATION_THEMES.map((t) => t.id);
export const themeById = (id) => PRESENTATION_THEMES.find((t) => t.id === id) || PRESENTATION_THEMES[0];

/** Inline style object that applies a theme's tokens to a subtree. */
export const themeStyle = (themeOrId) => {
	const t = typeof themeOrId === 'string' ? themeById(themeOrId) : themeOrId;
	// React wants camelCase for real CSS properties; the custom properties (--x) pass through unchanged
	const { 'color-scheme': colorScheme, ...vars } = t.tokens;
	return colorScheme ? { ...vars, colorScheme } : vars;
};

const THEME_KEY = 'company360.presentationTheme';
const OPTIONS_KEY = 'company360.presentationOptions';

export function readStoredTheme() {
	try {
		const v = window.localStorage.getItem(THEME_KEY);
		return THEME_IDS.includes(v) ? v : DEFAULT_PRESENTATION_THEME;
	} catch {
		return DEFAULT_PRESENTATION_THEME;
	}
}
export function storeTheme(id) {
	try {
		if (THEME_IDS.includes(id)) window.localStorage.setItem(THEME_KEY, id);
	} catch {
		/* the choice just is not remembered */
	}
}

/** Optional detail slides the viewer can add (people profiles, project records). */
export function readStoredOptions() {
	try {
		const v = JSON.parse(window.localStorage.getItem(OPTIONS_KEY) || '{}');
		return { people: v.people !== false, records: v.records !== false, reporting: v.reporting !== false };
	} catch {
		return { people: true, records: true, reporting: true };
	}
}
export function storeOptions(o) {
	try {
		window.localStorage.setItem(OPTIONS_KEY, JSON.stringify({ people: Boolean(o.people), records: Boolean(o.records), reporting: Boolean(o.reporting) }));
	} catch {
		/* not remembered */
	}
}
