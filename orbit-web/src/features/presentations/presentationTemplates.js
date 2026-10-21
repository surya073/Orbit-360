/**
 * Presentation templates. A template is more than a colour scheme: it picks a slide LAYOUT (how titles and content
 * are arranged), a colour theme, a slide transition and, for a new deck, a ready-made list of sections in a sensible
 * order. Layouts and templates are viewer choices (like the theme), so nothing here is stored with the deck.
 */

/** How a slide is arranged. The CSS lives in styles/presentationLayouts.css (`data-playout`). */
export const LAYOUTS = [
	{ id: 'classic', label: 'Classic', description: 'Title on top, content below. The original look.' },
	{ id: 'split', label: 'Split', description: 'Title and lead on the left, content on the right.' },
	{ id: 'centered', label: 'Centered', description: 'Centered titles and covers, balanced and calm.' },
	{ id: 'banner', label: 'Banner', description: 'A bold colour band carries the title; content sits below.' },
	{ id: 'minimal', label: 'Minimal', description: 'Small quiet titles and plenty of white space for the data.' },
];

export const DEFAULT_LAYOUT = 'classic';
export const LAYOUT_IDS = LAYOUTS.map((l) => l.id);
export const layoutById = (id) => LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];

/** Ready-made decks. `slides` use the same section keys as the editor (REPORT_SECTIONS). */
export const DECK_TEMPLATES = [
	{
		id: 'board',
		name: 'Board report',
		description: 'Formal quarterly pack: headline numbers, hours, projects and what to watch.',
		theme: 'corporate',
		layout: 'banner',
		transition: 'wipe',
		title: 'Board report',
		slides: ['executive_summary', 'billable_hours', 'project_performance', 'key_insights'],
	},
	{
		id: 'pitch',
		name: 'Startup pitch',
		description: 'A fast story: traction, delivery, product and where AI helps.',
		theme: 'pitch',
		layout: 'split',
		transition: 'slide',
		title: 'Company pitch',
		slides: ['executive_summary', 'billable_hours', 'product_development', 'ai_usage', 'key_insights'],
	},
	{
		id: 'people',
		name: 'People review',
		description: 'Headcount, attendance and leave, and how the team is organised.',
		theme: 'sage',
		layout: 'centered',
		transition: 'rise',
		title: 'People review',
		slides: ['employee_overview', 'attendance_leave', 'reporting_structure', 'key_insights'],
	},
	{
		id: 'magazine',
		name: 'Editorial brief',
		description: 'A calm, printed-report feel for a short written-style briefing.',
		theme: 'editorial',
		layout: 'minimal',
		transition: 'flip',
		title: 'Editorial brief',
		slides: ['executive_summary', 'project_performance', 'key_insights'],
	},
	{
		id: 'launch',
		name: 'Launch night',
		description: 'Loud and visual for product launches and creative reviews.',
		theme: 'neon',
		layout: 'centered',
		transition: 'zoom',
		title: 'Launch review',
		slides: ['executive_summary', 'product_development', 'ai_usage'],
	},
	{
		id: 'quick',
		name: 'Quick brief',
		description: 'Two slides for a five-minute update. Works in every room.',
		theme: 'aurora',
		layout: 'classic',
		transition: 'slide',
		title: 'Quick brief',
		slides: ['executive_summary', 'key_insights'],
	},
];
export const templateById = (id) => DECK_TEMPLATES.find((t) => t.id === id) || null;

const LAYOUT_KEY = 'company360.presentationLayout';
export function readStoredLayout() {
	try {
		const v = window.localStorage.getItem(LAYOUT_KEY);
		return LAYOUT_IDS.includes(v) ? v : DEFAULT_LAYOUT;
	} catch {
		return DEFAULT_LAYOUT;
	}
}
export function storeLayout(id) {
	try {
		if (LAYOUT_IDS.includes(id)) window.localStorage.setItem(LAYOUT_KEY, id);
	} catch {
		/* the choice just is not remembered */
	}
}
