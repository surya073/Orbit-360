// Theme registry. The color tokens live in styles/themes.css (seven hand-made themes) and styles/themes.extra.css
// (22 generated ones, see scripts/generate-themes.js), keyed by [data-theme="<id>"]; this file only describes the
// options the UI offers. Ember is the default. "System" is not a theme: it picks Light Blueberry or Black Current
// to match the device.
import extra from './extraThemes.json';

const CORE = [
	{ id: 'ember', label: 'Ember', description: 'Cinematic warm black with glass panels and an orange glow', scheme: 'dark' },
	{ id: 'blueberry', label: 'Light Blueberry', description: 'Clean white and cool blue-grey with blueberry accents', scheme: 'light' },
	{ id: 'blackcurrant', label: 'Black Current', description: 'Layered charcoal surfaces with a restrained berry accent', scheme: 'dark' },
	{ id: 'volcano', label: 'Volcano', description: 'Volcanic dark with ember red and molten orange', scheme: 'dark' },
	{ id: 'sunset', label: 'Sunset', description: 'Warm neutrals with sunset orange, coral and soft pink', scheme: 'light' },
	{ id: 'ocean', label: 'Ocean', description: 'Deep ocean blue with teal on blue-grey surfaces', scheme: 'light' },
	{ id: 'forest', label: 'Forest', description: 'Deep forest green with muted emerald and sage', scheme: 'light' },
];

export const THEMES = [...CORE, ...extra];

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

// More personal preferences (all per device, saved with the appearance).
export const RADII = [
	{ id: 'sharp', label: 'Sharp', hint: 'Square, technical corners' },
	{ id: 'default', label: 'Default', hint: 'The standard softness' },
	{ id: 'round', label: 'Round', hint: 'Friendly, pill-like corners' },
];
export const TEXT_SIZES = [
	{ id: 'small', label: 'Small', hint: '93%: fits more on screen' },
	{ id: 'default', label: 'Default', hint: '100%' },
	{ id: 'large', label: 'Large', hint: '110%: easier to read' },
	{ id: 'xlarge', label: 'Extra large', hint: '120%: for low vision' },
];
export const MOTIONS = [
	{ id: 'auto', label: 'Follow my device', hint: 'Animate unless the device asks for less motion' },
	{ id: 'reduced', label: 'Reduce motion', hint: 'No entrance, scroll or hover animations' },
];
export const WIDTHS = [
	{ id: 'standard', label: 'Standard', hint: 'Centred, up to 1400 px' },
	{ id: 'wide', label: 'Wide', hint: 'Up to 1680 px on large screens' },
	{ id: 'full', label: 'Full width', hint: 'Use the whole window' },
];
// Quick accent colours for Settings -> Appearance (a custom colour can also be typed or picked).
export const ACCENT_PRESETS = ['#ff8a3d', '#e5484d', '#e93d82', '#8e4ec6', '#5b5bd6', '#3b82f6', '#0ea5b7', '#12a594', '#30a46c', '#d6a600'];

// Fonts: the two self-hosted families, plus system stacks (nothing is downloaded). `ui` / `display` are CSS font stacks.
export const FONTS = [
	{ id: 'default', label: 'Company 360', hint: 'DM Sans with Manrope headings', ui: null, display: null },
	{ id: 'system', label: 'System', hint: 'Your device’s own interface font', ui: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", display: null },
	{ id: 'humanist', label: 'Humanist', hint: 'Warm and open, easy on long reading', ui: "'Segoe UI', 'Gill Sans', Optima, Candara, 'Trebuchet MS', sans-serif", display: null },
	{ id: 'rounded', label: 'Rounded', hint: 'Soft, friendly letterforms', ui: "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Varela Round', system-ui, sans-serif", display: null },
	{ id: 'serif', label: 'Editorial serif', hint: 'Report-style headings and text', ui: "Georgia, 'Iowan Old Style', 'Palatino Linotype', Cambria, serif", display: "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif" },
	{ id: 'mono', label: 'Technical mono', hint: 'Fixed-width, data-terminal feel', ui: "ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace", display: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
];

// Chart colour sets that replace the theme's own six series colours (each is nudged to stay visible on the theme).
export const PALETTES = [
	{ id: 'theme', label: 'Theme colours', hint: 'The colours that come with the theme', colors: null },
	{ id: 'vivid', label: 'Vivid', hint: 'Bold, saturated, easy to tell apart', colors: ['#ff6b35', '#00b4d8', '#7ed957', '#ff4d8d', '#8a5cf6', '#ffc300'] },
	{ id: 'pastel', label: 'Soft pastel', hint: 'Gentle tints for calm reports', colors: ['#f4a6a0', '#9ac7f0', '#a8dcb0', '#f6d28b', '#c8b0ec', '#9ed8d4'] },
	{ id: 'colorblind', label: 'Colour-blind safe', hint: 'Okabe-Ito set: distinct for all common colour-vision types', colors: ['#e69f00', '#56b4e9', '#009e73', '#f0e442', '#0072b2', '#d55e00'] },
	{ id: 'earth', label: 'Earth tones', hint: 'Clay, moss, sand and sea', colors: ['#c0713b', '#6b8e5a', '#d9b26f', '#4f8a8b', '#a65d57', '#8a7e6c'] },
	{ id: 'mono', label: 'One-colour tints', hint: 'Shades of your accent colour', colors: null },
];

// One-tap style templates: a theme, accent, shape, font and chart palette chosen to work together.
export const TEMPLATES = [
	{ id: 'executive', label: 'Executive', description: 'Graphite, sharp corners and an editorial serif for board packs', prefs: { theme: 'graphite', accent: '', radius: 'sharp', font: 'serif', palette: 'colorblind', density: 'comfortable', textSize: 'default' } },
	{ id: 'boardroom', label: 'Boardroom gold', description: 'Obsidian with champagne gold and calm shapes', prefs: { theme: 'obsidian', accent: '', radius: 'default', font: 'serif', palette: 'earth', density: 'comfortable', textSize: 'default' } },
	{ id: 'ops', label: 'Ops control', description: 'Dense, technical and fast to scan', prefs: { theme: 'midnight', accent: '', radius: 'sharp', font: 'system', palette: 'vivid', density: 'compact', textSize: 'small' } },
	{ id: 'fresh', label: 'Fresh and friendly', description: 'Light mint, round corners, soft type', prefs: { theme: 'mint', accent: '', radius: 'round', font: 'rounded', palette: 'theme', density: 'comfortable', textSize: 'default' } },
	{ id: 'report', label: 'Paper report', description: 'Warm paper tones that read like a printed report', prefs: { theme: 'paper', accent: '', radius: 'sharp', font: 'serif', palette: 'earth', density: 'comfortable', textSize: 'default' } },
	{ id: 'focus', label: 'Calm focus', description: 'Nord blues, larger text, gentle motion', prefs: { theme: 'nord', accent: '', radius: 'round', font: 'humanist', palette: 'pastel', density: 'comfortable', textSize: 'large' } },
	{ id: 'neon', label: 'Neon studio', description: 'Cyberpunk neon with vivid charts', prefs: { theme: 'cyber', accent: '', radius: 'round', font: 'default', palette: 'vivid', density: 'comfortable', textSize: 'default' } },
	{ id: 'classic', label: 'Company 360', description: 'Back to the original Ember look', prefs: { theme: 'ember', accent: '', radius: 'default', font: 'default', palette: 'theme', density: 'comfortable', textSize: 'default' } },
];
