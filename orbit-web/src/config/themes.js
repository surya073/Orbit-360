// Theme registry. The color tokens live in styles/themes.css, keyed by [data-theme="<id>"]; this file
// only describes the options the UI offers. Seven themes exist; Ember is the default. "System" is not a theme: it
// picks Light Blueberry or Black Current to match the device.
export const THEMES = [
	{ id: 'ember', label: 'Ember', description: 'Cinematic warm black with glass panels and an orange glow', scheme: 'dark' },
	{ id: 'blueberry', label: 'Light Blueberry', description: 'Clean white and cool blue-grey with blueberry accents', scheme: 'light' },
	{ id: 'blackcurrant', label: 'Black Current', description: 'Layered charcoal surfaces with a restrained berry accent', scheme: 'dark' },
	{ id: 'volcano', label: 'Volcano', description: 'Volcanic dark with ember red and molten orange', scheme: 'dark' },
	{ id: 'sunset', label: 'Sunset', description: 'Warm neutrals with sunset orange, coral and soft pink', scheme: 'light' },
	{ id: 'ocean', label: 'Ocean', description: 'Deep ocean blue with teal on blue-grey surfaces', scheme: 'light' },
	{ id: 'forest', label: 'Forest', description: 'Deep forest green with muted emerald and sage', scheme: 'light' },
];

export const SYSTEM_THEME = { id: 'system', label: 'System', description: 'Follow your device: Light Blueberry or Black Current' };

export const THEME_IDS = THEMES.map((t) => t.id);
export const DEFAULT_THEME = 'ember';
// Used when "System" is selected: which theme matches the OS preference.
export const SYSTEM_MAP = { light: 'blueberry', dark: 'blackcurrant' };

// Themes saved by earlier versions are mapped to their closest successor on load.
export const LEGACY_THEMES = { light: 'blueberry', dark: 'blackcurrant', moon: 'blackcurrant', beach: 'ocean' };

export const APPEARANCE_KEY = 'company360.appearance';
export const DENSITIES = [
	{ id: 'comfortable', label: 'Comfortable' },
	{ id: 'compact', label: 'Compact' },
];
