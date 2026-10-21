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

/**
 * Story templates: WHAT a presentation says and in which order, independent of how it looks (theme, layout and transition
 * are chosen separately, so any story works with any theme). Every slide is built from live data by the same section
 * renderers the dashboard uses; a story contains no numbers or people of its own. `detail` switches on the extra slides built
 * from real records (people, projects, the saved reporting tree). Slides the viewer may not see are left out by the player.
 */
export const STORY_SAVED = 'saved';
export const STORY_TEMPLATES = [
	{
		id: 'executive',
		name: 'Executive Overview',
		audience: 'Leadership and board',
		purpose: 'A concise summary: headline numbers, where time goes, which projects need attention and what to decide.',
		slides: ['executive_summary', 'billable_hours', 'project_performance', 'key_insights'],
		detail: { people: false, records: false, reporting: false },
	},
	{
		id: 'team_performance',
		name: 'Team Performance Review',
		audience: 'Managers and HR',
		purpose: 'How the team is made up, who is present, who is on leave and how much approved work was delivered.',
		slides: ['employee_overview', 'attendance_leave', 'billable_hours', 'key_insights'],
		detail: { people: true, records: false, reporting: false },
	},
	{
		id: 'project_portfolio',
		name: 'Project Portfolio Review',
		audience: 'Delivery and programme leads',
		purpose: 'Project status and workload against estimates, product work in flight and the records behind them.',
		slides: ['project_performance', 'billable_hours', 'product_development', 'key_insights'],
		detail: { people: false, records: true, reporting: false },
	},
	{
		id: 'people_reporting',
		name: 'People and Reporting Structure',
		audience: 'New joiners, HR and leadership',
		purpose: 'Who is on the team, their roles and profiles, and the saved reporting tree.',
		slides: ['employee_overview', 'reporting_structure', 'attendance_leave'],
		detail: { people: true, records: false, reporting: true },
	},
	{
		id: 'company_360',
		name: 'Comprehensive Company 360',
		audience: 'Annual and quarterly reviews',
		purpose: 'The whole picture: people, attendance, time, projects, product work, AI usage and the key insights.',
		slides: ['executive_summary', 'employee_overview', 'attendance_leave', 'billable_hours', 'project_performance', 'product_development', 'ai_usage', 'reporting_structure', 'key_insights'],
		detail: { people: true, records: true, reporting: true },
	},
];
export const storyById = (id) => STORY_TEMPLATES.find((s) => s.id === id) || null;
/** The deck slides a story plays: its sections in its order (a viewer without access to some data drops those via `allow`). */
export const storySlides = (story, allow = () => true) => story.slides.filter(allow).map((section) => ({ type: 'section', section }));

const STORY_KEY = 'company360.presentationStory';
export function readStoredStory() {
	try {
		const v = window.localStorage.getItem(STORY_KEY);
		return storyById(v) ? v : STORY_SAVED;
	} catch {
		return STORY_SAVED;
	}
}
export function storeStory(id) {
	try {
		if (id === STORY_SAVED || storyById(id)) window.localStorage.setItem(STORY_KEY, id);
	} catch {
		/* the choice just is not remembered */
	}
}
