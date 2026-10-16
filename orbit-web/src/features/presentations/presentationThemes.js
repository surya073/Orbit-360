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

export const PRESENTATION_THEMES = [
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
