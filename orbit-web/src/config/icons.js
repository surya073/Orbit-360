// Icon sets the UI offers. All but "classic" come from react-icons families (see
// components/common/iconSets.js); "classic" is our original hand-drawn outline set in Icon.js.
export const ICON_STYLES = [
	{ id: 'tabler', label: 'Tabler', description: 'Crisp, geometric outlines' },
	{ id: 'remix', label: 'Remix', description: 'Clean, friendly line icons' },
	{ id: 'remix-fill', label: 'Remix Solid', description: 'The same shapes, filled in' },
	{ id: 'material', label: 'Material', description: 'Google-style outlined icons' },
	{ id: 'hero', label: 'Heroicons', description: 'Simple, balanced outlines' },
	{ id: 'hero-solid', label: 'Heroicons Solid', description: 'Bold filled glyphs' },
	{ id: 'ionic', label: 'Ionicons', description: 'Soft, rounded outlines' },
	{ id: 'classic', label: 'Classic', description: 'Our original thin outline icons' },
];

export const ICON_STYLE_IDS = ICON_STYLES.map((s) => s.id);
export const DEFAULT_ICON_STYLE = 'tabler';

// Icons shown in each style preview tile (all real icons used by the app).
export const ICON_PREVIEW = ['dashboard', 'users', 'clock', 'folder', 'sparkles', 'present'];
