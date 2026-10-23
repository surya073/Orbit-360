import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { IconStyleContext } from '../../components/common/iconStyle';
import { DEFAULT_ICON_STYLE, ICON_STYLE_IDS } from '../../config/icons';
import { APPEARANCE_KEY, DEFAULT_THEME, DENSITIES, LEGACY_THEMES, FONTS, MOTIONS, PALETTES, RADII, SYSTEM_MAP, TEXT_SIZES, THEME_IDS, WIDTHS } from '../../config/themes';
import { ACCENT_VARS, CHART_VARS, accentVars, isHex, paletteVars, tintColors } from '../../utils/accent';
import { motionReduced } from '../../utils/motion';

/**
 * Appearance = theme (one of the six, or 'system') + table density + icon style. It is a per-device
 * cosmetic preference, so it is kept in localStorage (no backend call); storage failures degrade to
 * session-only. index.html applies the stored theme before first paint to avoid a flash.
 */
const DEFAULTS = { theme: DEFAULT_THEME, density: 'comfortable', iconStyle: DEFAULT_ICON_STYLE, accent: '', radius: 'default', textSize: 'default', motion: 'auto', width: 'standard', font: 'default', palette: 'theme', sidebar: '', cards: 'raised' };
const VALID_DENSITY = DENSITIES.map((d) => d.id);
const oneOf = (list, v, fallback) => (list.some((x) => x.id === v) ? v : fallback);

export function readAppearance(storage = window.localStorage) {
	try {
		const raw = JSON.parse(storage.getItem(APPEARANCE_KEY) || '{}');
		const stored = LEGACY_THEMES[raw.theme] || raw.theme; // themes from earlier versions map to a successor
		return {
			theme: stored === 'system' || THEME_IDS.includes(stored) ? stored : DEFAULTS.theme,
			density: VALID_DENSITY.includes(raw.density) ? raw.density : DEFAULTS.density,
			iconStyle: ICON_STYLE_IDS.includes(raw.iconStyle) ? raw.iconStyle : DEFAULTS.iconStyle,
			accent: isHex(raw.accent) ? raw.accent.toLowerCase() : '',
			radius: oneOf(RADII, raw.radius, DEFAULTS.radius),
			textSize: oneOf(TEXT_SIZES, raw.textSize, DEFAULTS.textSize),
			motion: oneOf(MOTIONS, raw.motion, DEFAULTS.motion),
			width: oneOf(WIDTHS, raw.width, DEFAULTS.width),
			font: oneOf(FONTS, raw.font, DEFAULTS.font),
			palette: oneOf(PALETTES, raw.palette, DEFAULTS.palette),
			sidebar: isHex(raw.sidebar) ? raw.sidebar.toLowerCase() : '',
			cards: ['raised', 'flat', 'outlined'].includes(raw.cards) ? raw.cards : DEFAULTS.cards,
		};
	} catch {
		return DEFAULTS;
	}
}

export const resolveTheme = (pref, prefersDark) => (pref === 'system' ? SYSTEM_MAP[prefersDark ? 'dark' : 'light'] : pref);

const ThemeContext = createContext(null);
const reducedMotion = motionReduced;

export function ThemeProvider({ children }) {
	const [prefs, setPrefs] = useState(readAppearance);
	const [prefersDark, setPrefersDark] = useState(() => (window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false));

	useEffect(() => {
		const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
		if (!mq || !mq.addEventListener) return undefined;
		const h = (e) => setPrefersDark(e.matches);
		mq.addEventListener('change', h);
		return () => mq.removeEventListener('change', h);
	}, []);

	const resolved = resolveTheme(prefs.theme, prefersDark);

	useEffect(() => {
		const root = document.documentElement;
		root.dataset.theme = resolved;
		root.dataset.themePref = prefs.theme;
		root.dataset.density = prefs.density;
		root.dataset.iconStyle = prefs.iconStyle;
		root.dataset.radius = prefs.radius;
		root.dataset.text = prefs.textSize;
		root.dataset.motion = prefs.motion;
		root.dataset.width = prefs.width;
		root.dataset.font = prefs.font;
		root.dataset.cards = prefs.cards;
		// A chosen sidebar colour replaces the sidebar's gradient; its icons and text switch to dark or light to stay readable.
		['--rail-custom', '--rail-on'].forEach((k) => root.style.removeProperty(k));
		if (isHex(prefs.sidebar)) {
			const [r, g, b] = [1, 3, 5].map((i) => parseInt(prefs.sidebar.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
			root.style.setProperty('--rail-custom', prefs.sidebar);
			root.style.setProperty('--rail-on', 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#14161c' : '#ffffff');
			root.dataset.rail = 'custom';
		} else delete root.dataset.rail;
		const font = FONTS.find((f) => f.id === prefs.font);
		['--font-ui', '--font-display'].forEach((k) => root.style.removeProperty(k));
		const fontVars = font && font.ui ? { '--font-ui': font.ui, '--font-display': font.display || font.ui } : null;
		if (fontVars) Object.entries(fontVars).forEach(([k, v]) => root.style.setProperty(k, v));
		// A custom accent is re-derived for whichever theme is active, so it stays readable on its surfaces.
		let derived = null;
		[...ACCENT_VARS, ...CHART_VARS].forEach((k) => root.style.removeProperty(k));
		const cs = window.getComputedStyle(root);
		const surface = cs.getPropertyValue('--surface').trim();
		const bg = cs.getPropertyValue('--bg').trim();
		if (isHex(surface) && isHex(bg)) {
			const pal = PALETTES.find((p) => p.id === prefs.palette);
			const colors = prefs.palette === 'mono' ? tintColors(isHex(prefs.accent) ? prefs.accent : window.getComputedStyle(root).getPropertyValue('--accent').trim()) : pal && pal.colors;
			if (colors && colors.every(isHex)) derived = { ...paletteVars(colors, { surface }) };
			if (prefs.accent) {
				const a = accentVars(prefs.accent, { surface, bg });
				if (derived) delete a['--chart-1']; // a chosen palette owns the chart colours
				derived = { ...(derived || {}), ...a };
			}
			if (derived) Object.entries(derived).forEach(([k, v]) => root.style.setProperty(k, v));
		}
		try {
			// the derived colours and fonts are stored too so index.html can paint them before React starts
			const stored = { ...(derived ? { accentVars: { ...derived, ...(fontVars || {}) } } : fontVars ? { accentVars: fontVars } : {}) };
			window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ ...prefs, ...stored }));
		} catch {
			/* storage unavailable: applies for this session only */
		}
	}, [prefs, resolved]);

	// Ease colors briefly when the user changes theme (skipped for reduced motion).
	const animate = useCallback(() => {
		if (reducedMotion()) return;
		const root = document.documentElement;
		root.classList.add('theme-transition');
		setTimeout(() => root.classList.remove('theme-transition'), 350);
	}, []);

	const value = useMemo(
		() => ({
			...prefs,
			resolved,
			setTheme: (theme) => {
				animate();
				setPrefs((p) => ({ ...p, theme }));
			},
			setDensity: (density) => setPrefs((p) => ({ ...p, density })),
			setIconStyle: (iconStyle) => setPrefs((p) => ({ ...p, iconStyle })),
			setAppearance: (patch) => setPrefs((p) => ({ ...p, ...patch })),
		}),
		[prefs, resolved, animate]
	);
	return (
		<ThemeContext.Provider value={value}>
			<IconStyleContext.Provider value={prefs.iconStyle}>{children}</IconStyleContext.Provider>
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
	return ctx;
}
