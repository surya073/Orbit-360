// Theme registry. The color tokens themselves live in styles/themes.css, keyed by
// [data-theme="<id>"]; this file only describes the options the UI offers.
export const THEMES = [
	{ id: 'sunset', label: 'Sunset', description: 'Warm amber, coral and muted rose', scheme: 'light' },
	{ id: 'moon', label: 'Moon', description: 'Refined dark slate with cool blue highlights', scheme: 'dark' },
	{ id: 'beach', label: 'Beach', description: 'Soft sand, ocean blue and muted teal', scheme: 'light' },
	{ id: 'dark', label: 'Dark', description: 'Neutral dark with restrained contrast', scheme: 'dark' },
	{ id: 'light', label: 'Light', description: 'Clean neutral light interface', scheme: 'light' },
];

export const SYSTEM_THEME = { id: 'system', label: 'System', description: 'Follow your device appearance (Light or Dark)' };

export const THEME_IDS = THEMES.map((t) => t.id);
export const DEFAULT_THEME = 'light';
// Used when "System" is selected: which theme matches the OS preference.
export const SYSTEM_MAP = { light: 'light', dark: 'dark' };

export const APPEARANCE_KEY = 'company360.appearance';
export const DENSITIES = [
	{ id: 'comfortable', label: 'Comfortable' },
	{ id: 'compact', label: 'Compact' },
];
