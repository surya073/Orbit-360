import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { IconStyleContext } from '../../components/common/iconStyle';
import { DEFAULT_ICON_STYLE, ICON_STYLE_IDS } from '../../config/icons';
import { APPEARANCE_KEY, DEFAULT_THEME, DENSITIES, LEGACY_THEMES, SYSTEM_MAP, THEME_IDS } from '../../config/themes';

/**
 * Appearance = theme (one of the six, or 'system') + table density + icon style. It is a per-device
 * cosmetic preference, so it is kept in localStorage (no backend call); storage failures degrade to
 * session-only. index.html applies the stored theme before first paint to avoid a flash.
 */
const DEFAULTS = { theme: DEFAULT_THEME, density: 'comfortable', iconStyle: DEFAULT_ICON_STYLE };
const VALID_DENSITY = DENSITIES.map((d) => d.id);

export function readAppearance(storage = window.localStorage) {
	try {
		const raw = JSON.parse(storage.getItem(APPEARANCE_KEY) || '{}');
		const stored = LEGACY_THEMES[raw.theme] || raw.theme; // themes from earlier versions map to a successor
		return {
			theme: stored === 'system' || THEME_IDS.includes(stored) ? stored : DEFAULTS.theme,
			density: VALID_DENSITY.includes(raw.density) ? raw.density : DEFAULTS.density,
			iconStyle: ICON_STYLE_IDS.includes(raw.iconStyle) ? raw.iconStyle : DEFAULTS.iconStyle,
		};
	} catch {
		return DEFAULTS;
	}
}

export const resolveTheme = (pref, prefersDark) => (pref === 'system' ? SYSTEM_MAP[prefersDark ? 'dark' : 'light'] : pref);

const ThemeContext = createContext(null);
const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
		try {
			window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify(prefs));
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
