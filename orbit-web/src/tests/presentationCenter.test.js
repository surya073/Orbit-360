import { pickOption } from './pickOption';
import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import PresentationPlayer from '../features/presentations/PresentationPlayer';
import PresentationsPage from '../features/presentations/PresentationsPage';
import { buildSlides, detailOptions, initials, PEOPLE_PER_SLIDE, PROFILE_LIMIT, RECORDS_PER_SLIDE, tenureText } from '../features/presentations/deckSlides';
import { PRESENTATION_THEMES, readStoredOptions, readStoredTheme, storeTheme, themeById, themeStyle } from '../features/presentations/presentationThemes';
import { __clearLookupCache } from '../hooks/useLookup';
import { dashboardRoutes, errBody, mockFetch, okBody, renderWithProviders } from './helpers';

// The first test in this file renders a heavy page (theme gallery / launcher); under a parallel full run that can pass 5 s.
jest.setTimeout(20000);

// ---- theme tokens ----------------------------------------------------------------------------
const lum = (hex) => {
	const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
	const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
};

const REQUIRED = ['--bg', '--surface', '--surface-2', '--surface-3', '--border', '--border-strong', '--text', '--text-muted', '--on-accent', '--accent', '--accent-hover', '--accent-contrast', '--accent-soft', '--focus', '--ring', '--success', '--warning', '--danger', '--info', '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6', '--chart-grid', '--gradient-accent', '--p-bg', '--p-letterbox', '--p-card', '--p-card-border', '--p-kpi-bg', '--p-title-gradient', '--p-glow', '--p-font-display'];

describe('presentation themes', () => {
	test('there are ten templates, with the requested names and distinct identities', () => {
		expect(PRESENTATION_THEMES.map((t) => t.name)).toEqual(['Aurora Executive', 'Obsidian Luxe', 'Crystal Blue', 'Sunset Prestige', 'Emerald Vision', 'Modern Editorial', 'Startup Pitch', 'Neon Poster', 'Calm Sage', 'Corporate Navy']);
		expect(new Set(PRESENTATION_THEMES.map((t) => t.tokens['--accent'])).size).toBe(10);
		expect(new Set(PRESENTATION_THEMES.map((t) => t.tokens['--p-bg'])).size).toBe(10);
		expect(new Set(PRESENTATION_THEMES.map((t) => t.tokens['--p-font-display'])).size).toBeGreaterThan(1); // Obsidian speaks in a serif
	});

	describe.each(PRESENTATION_THEMES.map((t) => [t.id, t]))('%s', (id, t) => {
		const k = t.tokens;
		test('defines the full token set', () => {
			for (const key of REQUIRED) expect(k[key]).toBeDefined();
		});
		test('text, muted text and accent meet WCAG AA on the slide surfaces', () => {
			for (const surface of ['--bg', '--surface', '--surface-2']) {
				expect(contrast(k['--text'], k[surface])).toBeGreaterThanOrEqual(4.5);
				expect(contrast(k['--text-muted'], k[surface])).toBeGreaterThanOrEqual(4.5);
				expect(contrast(k['--accent'], k[surface])).toBeGreaterThanOrEqual(4.5);
			}
			expect(contrast(k['--on-accent'], k['--accent'])).toBeGreaterThanOrEqual(4.5);
			expect(contrast(k['--accent'], k['--accent-soft'])).toBeGreaterThanOrEqual(4.5);
		});
		test('status colours are readable on their soft backgrounds and charts stand out from the surface', () => {
			for (const s of ['success', 'warning', 'danger', 'info']) {
				expect(contrast(k[`--${s}`], k[`--${s}-soft`])).toBeGreaterThanOrEqual(4.5);
				expect(contrast(k[`--${s}`], k['--surface'])).toBeGreaterThanOrEqual(4.5);
			}
			for (let i = 1; i <= 6; i++) expect(contrast(k[`--chart-${i}`], k['--surface'])).toBeGreaterThanOrEqual(3);
		});
	});

	test('themeStyle returns the tokens and unknown ids fall back to the first theme', () => {
		expect(themeStyle('emerald')['--accent']).toBe(themeById('emerald').tokens['--accent']);
		expect(themeById('nope').id).toBe('aurora');
	});

	test('the chosen theme and detail options are remembered per device', () => {
		window.localStorage.clear();
		expect(readStoredTheme()).toBe('aurora');
		storeTheme('sunset');
		expect(readStoredTheme()).toBe('sunset');
		storeTheme('not-a-theme');
		expect(readStoredTheme()).toBe('sunset');
		expect(readStoredOptions()).toEqual({ people: true, records: true, reporting: true });
		window.localStorage.clear();
	});
});

// ---- slide building ---------------------------------------------------------------------------
describe('slide building', () => {
	const deckSlides = [{ type: 'section', section: 'executive_summary' }, { type: 'section', section: 'employee_overview' }, { type: 'section', section: 'project_performance' }, { type: 'text', title: 'Thanks', body: 'Q?' }];
	const person = (n) => ({ ROWID: String(n), full_name: `Person ${n}` });
	const ok = (rows, total = rows.length) => ({ status: 'success', data: rows, meta: { total } });

	test('wraps the saved deck in an opening and a closing slide without changing it', () => {
		const out = buildSlides(deckSlides);
		expect(out[0].kind).toBe('opening');
		expect(out[out.length - 1].kind).toBe('closing');
		expect(out.filter((s) => s.kind === 'deck').map((s) => s.slide)).toEqual(deckSlides);
		expect(out).toHaveLength(6);
	});

	test('people overview and profile slides are added right after the employee section, in bounded numbers', () => {
		const people = ok(Array.from({ length: 16 }, (_, i) => person(i + 1)), 40);
		const out = buildSlides(deckSlides, { people, wantPeople: true });
		const kinds = out.map((s) => s.kind);
		expect(kinds.slice(0, 3)).toEqual(['opening', 'deck', 'deck']);
		const overview = out.filter((s) => s.kind === 'people');
		expect(overview).toHaveLength(2);
		expect(overview[0].rows).toHaveLength(PEOPLE_PER_SLIDE);
		expect(overview[0].total).toBe(40); // the real total, so the slide can say "16 of 40"
		expect(out.filter((s) => s.kind === 'profile')).toHaveLength(PROFILE_LIMIT);
		expect(out[3].kind).toBe('people'); // directly after the employee overview section
	});

	test('record slides follow project performance and chunk the rows', () => {
		const records = ok(Array.from({ length: 12 }, (_, i) => ({ ROWID: String(i), project_name: `P${i}` })), 12);
		const out = buildSlides(deckSlides, { records, wantRecords: true });
		const recs = out.filter((s) => s.kind === 'records');
		expect(recs).toHaveLength(12 / RECORDS_PER_SLIDE);
		expect(out.indexOf(recs[0])).toBe(out.findIndex((s) => s.kind === 'deck' && s.slide.section === 'project_performance') + 1);
	});

	test('loading, failed and empty detail data become honest placeholder slides, never invented rows', () => {
		const state = (people) => buildSlides(deckSlides, { people, wantPeople: true }).find((s) => s.kind === 'detail-state');
		expect(state({ status: 'loading' })).toMatchObject({ topic: 'people', state: 'loading' });
		expect(state({ status: 'error', error: new Error('x') })).toMatchObject({ state: 'error' });
		expect(state(ok([]))).toMatchObject({ state: 'empty' });
	});

	test('detail slides are only offered when the deck has the matching section', () => {
		expect(detailOptions(deckSlides)).toEqual({ people: true, records: true, reporting: true });
		expect(detailOptions([{ type: 'section', section: 'ai_usage' }])).toEqual({ people: false, records: false, reporting: true });
		expect(buildSlides([{ type: 'section', section: 'ai_usage' }], { wantPeople: true, people: ok([person(1)]) }).some((s) => s.kind === 'people')).toBe(false);
	});

	test('initials and calculated tenure', () => {
		expect(initials('Asha Rao')).toBe('AR');
		expect(initials('  ')).toBe('?');
		expect(tenureText('2024-01-10', new Date(2026, 2, 20))).toBe('2 yrs 2 mo');
		expect(tenureText('2026-03-01', new Date(2026, 2, 20))).toBe('0 mo');
		expect(tenureText(null)).toBeNull();
		expect(tenureText('2030-01-01', new Date(2026, 2, 20))).toBeNull();
	});
});

// ---- landing page + launcher ------------------------------------------------------------------
const meta = (total) => ({ page: 1, pageSize: 20, total, totalPages: 1 });
const rows = [{ ROWID: '5', title: 'Board review', team_id: '7', status: 'ready', last_presented_at: null, MODIFIEDTIME: '2026-10-01 09:00:00' }, { ROWID: '6', title: 'All hands', team_id: null, status: 'draft', MODIFIEDTIME: '2026-10-02 09:00:00' }];
const deckSlides = [{ type: 'section', section: 'employee_overview' }, { type: 'section', section: 'project_performance' }];
const deckBody = (over = {}) => ({ ROWID: '5', title: 'Board review', team_id: '7', status: 'ready', slidesAvailable: true, slides: deckSlides, config: { v: 2, period: { preset: 'this_month' }, filters: { teamId: '7', projectId: null }, slides: deckSlides }, ...over });

function Where() {
	const l = useLocation();
	return <div data-testid="where">{`${l.pathname}${l.search}`}</div>;
}
function CenterRoutes() {
	return (
		<Routes>
			<Route path="/presentations" element={<PresentationsPage />} />
			<Route path="/presentations/:id/present" element={<Where />} />
		</Routes>
	);
}

beforeEach(() => {
	__clearLookupCache();
	window.localStorage.clear();
});
afterEach(() => {
	delete global.fetch;
});

describe('presentation center landing page and launcher', () => {
	const listRoutes = () => [[/^GET \/presentations\/5$/, okBody(deckBody())], [/^GET \/presentations\/6$/, okBody(deckBody({ ROWID: '6', title: 'All hands', slides: [{ type: 'section', section: 'ai_usage' }], config: { v: 2, period: { preset: 'this_month' }, filters: {}, slides: [{ type: 'section', section: 'ai_usage' }] } }))], [/^GET \/presentations/, okBody(rows, meta(2))], [/^GET \/teams/, okBody([{ ROWID: '7', name: 'Delivery' }], meta(1))]];

	test('Play Presentation opens the launcher instead of playing; ten colour themes, six templates and five layouts are offered', async () => {
		mockFetch(listRoutes());
		renderWithProviders(<CenterRoutes />, { route: '/presentations' });
		await screen.findByRole('heading', { name: 'Board review' });
		await userEvent.click(screen.getByRole('button', { name: 'Play Presentation' }));
		const dialog = await screen.findByRole('dialog', { name: 'Choose Your Presentation Experience' });
		expect(within(within(dialog).getByRole('group', { name: 'Presentation theme' })).getAllByRole('radio')).toHaveLength(10);
		expect(within(within(dialog).getByRole('radiogroup', { name: 'Slide layout' })).getAllByRole('radio')).toHaveLength(5);
		expect(within(dialog).getAllByRole('button', { pressed: false }).length).toBeGreaterThanOrEqual(5); // template cards
		expect(within(dialog).getByRole('button', { name: 'Start Presentation' })).toBeInTheDocument();
		expect(screen.queryByTestId('where')).not.toBeInTheDocument(); // nothing is playing yet
	});

	test('selecting a theme updates the preview and is remembered; Start opens the viewer with that theme and the detail options', async () => {
		mockFetch(listRoutes());
		renderWithProviders(<CenterRoutes />, { route: '/presentations' });
		await screen.findByRole('heading', { name: 'Board review' });
		await userEvent.click(screen.getByRole('button', { name: 'Play Presentation' }));
		const dialog = await screen.findByRole('dialog', { name: 'Choose Your Presentation Experience' });
		expect(within(dialog).getByRole('radio', { name: /Aurora Executive/ })).toBeChecked();
		await userEvent.click(within(dialog).getByRole('radio', { name: /Obsidian Luxe/ }));
		expect(within(dialog).getByRole('region', { name: 'Obsidian Luxe preview' })).toBeInTheDocument();
		expect(dialog.querySelector('.pl__panel')).toHaveAttribute('data-ptheme', 'obsidian');
		expect(readStoredTheme()).toBe('obsidian');
		// the deck has employee + project sections, so both detail options are offered
		const people = await within(dialog).findByRole('checkbox', { name: /team overview and individual profile/i });
		await userEvent.click(within(dialog).getByRole('checkbox', { name: /project record/i })); // turn records off
		expect(people).toBeChecked();
		await userEvent.click(within(dialog).getByRole('button', { name: 'Start Presentation' }));
		expect(await screen.findByTestId('where')).toHaveTextContent('/presentations/5/present?theme=obsidian&layout=classic&people=1&records=0&reporting=1');
	});

	test('a presentation template is chosen separately from the theme: it lists audience and slide order, is remembered, and Start carries it to the viewer', async () => {
		mockFetch(listRoutes());
		renderWithProviders(<CenterRoutes />, { route: '/presentations' });
		await screen.findByRole('heading', { name: 'Board review' });
		await userEvent.click(screen.getByRole('button', { name: 'Play Presentation' }));
		const dialog = await screen.findByRole('dialog', { name: 'Choose Your Presentation Experience' });
		const stories = within(dialog).getByRole('radiogroup', { name: 'Presentation template' });
		expect(within(stories).getAllByRole('radio')).toHaveLength(6); // "As saved" + the five story templates
		expect(within(stories).getByRole('radio', { name: /As saved/ })).toBeChecked();
		const exec = within(stories).getByRole('radio', { name: /Executive Overview/ });
		expect(exec).toHaveTextContent('For: Leadership and board');
		expect(within(within(stories).getByRole('list', { name: 'Slides in Executive Overview' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Executive summary', 'Billable hours', 'Project performance', 'Key insights']);
		await userEvent.click(exec);
		await userEvent.click(within(dialog).getByRole('radio', { name: /Obsidian Luxe/ })); // a theme on top of the template
		expect(dialog.querySelector('.pl__hint')).toHaveTextContent(/Executive Overview · Obsidian Luxe theme · Classic layout/); // the summary above Start
		await userEvent.click(within(dialog).getByRole('button', { name: 'Start Presentation' }));
		expect(await screen.findByTestId('where')).toHaveTextContent(/theme=obsidian&layout=classic&.*&story=executive$/);
		expect(window.localStorage.getItem('company360.presentationStory')).toBe('executive');
	});

	test('Escape closes the launcher and Cancel does too; the theme can be changed before starting without a reload', async () => {
		mockFetch(listRoutes());
		renderWithProviders(<CenterRoutes />, { route: '/presentations' });
		await screen.findByRole('heading', { name: 'Board review' });
		await userEvent.click(screen.getByRole('button', { name: 'Present All hands' }));
		let dialog = await screen.findByRole('dialog', { name: 'Choose Your Presentation Experience' });
		await userEvent.click(within(dialog).getByRole('radio', { name: /Emerald Vision/ }));
		await userEvent.click(within(dialog).getByRole('radio', { name: /Crystal Blue/ }));
		expect(dialog.querySelector('.pl__panel')).toHaveAttribute('data-ptheme', 'crystal');
		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Choose Your Presentation Experience' })).not.toBeInTheDocument());
		await userEvent.click(screen.getByRole('button', { name: 'Play Presentation' }));
		dialog = await screen.findByRole('dialog', { name: 'Choose Your Presentation Experience' });
		expect(within(dialog).getByRole('radio', { name: /Crystal Blue/ })).toBeChecked(); // remembered
		await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	test('the page-size choice is offered and the list is requested with it', async () => {
		mockFetch(listRoutes());
		renderWithProviders(<CenterRoutes />, { route: '/presentations' });
		await screen.findByRole('heading', { name: 'Board review' });
		await pickOption(screen.getByLabelText('Rows per page'), '50');
		await waitFor(() => expect(global.fetch.calls.some((c) => /GET \/presentations\?.*pageSize=50/.test(c.line))).toBe(true));
	});

	test('with no presentations Play is disabled and the empty state offers to create one', async () => {
		mockFetch([[/^GET \/presentations/, okBody([], meta(0))]]);
		renderWithProviders(<CenterRoutes />, { route: '/presentations' });
		expect(await screen.findByText('No presentations yet')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Play Presentation' })).toBeDisabled();
	});

	test('a list failure is reported, with no fake decks', async () => {
		mockFetch([[/^GET \/presentations/, { status: 403, body: errBody(403, 'FORBIDDEN', 'No access') }]]);
		renderWithProviders(<CenterRoutes />, { route: '/presentations' });
		expect(await screen.findByText(/do not have access/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Play Presentation' })).toBeDisabled();
	});
});

describe('studio decks and damaged decks on the presentation center', () => {
	const studioCover = { type: 'custom', bg: { kind: 'solid', color: '#101820' }, objects: [{ id: 'a', kind: 'text', x: 100, y: 100, w: 800, h: 120, text: 'Annual numbers', st: { fs: 80, color: '#ffffff' } }] };
	const listRows = [
		{ ...rows[0], studio: true, slideCount: 6, cover: studioCover },
		{ ...rows[1], studio: false, slideCount: 2, cover: null },
		{ ROWID: '8', title: 'Old deck', team_id: null, status: 'draft', MODIFIEDTIME: '2026-10-03 09:00:00', slideCount: null, cover: null, unreadable: true },
	];
	const routes = (extra = []) => [...extra, [/^GET \/presentations\/5$/, okBody(deckBody({ slides: [studioCover], config: { v: 2, period: { preset: 'this_month' }, filters: { teamId: '7', projectId: null }, slides: [studioCover] } }))], [/^POST \/presentations$/, { status: 201, body: okBody({ ROWID: '30' }) }], [/^DELETE \/presentations\/6/, okBody({ ROWID: '6', deleted: true })], [/^GET \/presentations/, okBody(listRows, meta(3))], [/^GET \/teams/, okBody([{ ROWID: '7', name: 'Delivery' }], meta(1))]];

	test('a studio deck is a card that looks like its first slide, with its status, team and slide count', async () => {
		mockFetch(routes());
		renderWithProviders(<CenterRoutes />, { route: '/presentations' });
		const list = await screen.findByRole('list', { name: 'Your presentations' });
		const card = within(list).getByRole('heading', { name: 'Board review' }).closest('li');
		expect(within(card).getByText('Annual numbers')).toBeInTheDocument(); // the real first slide, scaled down
		expect(within(card).getByText('Ready')).toBeInTheDocument();
		expect(await within(card).findByText('Delivery')).toBeInTheDocument();
		expect(within(card).getByText('6 slides')).toBeInTheDocument();
		expect(within(list).getByRole('heading', { name: 'All hands' })).toBeInTheDocument(); // a report deck keeps the themed preview
	});

	test('a studio deck plays straight away (its design is its own), while a report deck opens the launcher', async () => {
		mockFetch(routes());
		renderWithProviders(<CenterRoutes />, { route: '/presentations' });
		await userEvent.click(await screen.findByRole('button', { name: 'Present Board review' }));
		expect(await screen.findByTestId('where')).toHaveTextContent('/presentations/5/present');
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	test('a deck whose slides cannot be read says so on its card and cannot be presented or copied', async () => {
		mockFetch(routes());
		renderWithProviders(<CenterRoutes />, { route: '/presentations' });
		const card = (await screen.findByRole('heading', { name: 'Old deck' })).closest('li');
		expect(within(card).getByRole('alert')).toHaveTextContent(/damaged/i);
		expect(within(card).getByRole('button', { name: 'Present Old deck' })).toBeDisabled();
		expect(within(card).queryByRole('button', { name: 'Duplicate Old deck' })).not.toBeInTheDocument();
		expect(within(card).getByRole('button', { name: 'Delete Old deck' })).toBeEnabled();
	});

	test('Duplicate saves a draft copy with the same slides', async () => {
		mockFetch(routes());
		renderWithProviders(<CenterRoutes />, { route: '/presentations' });
		await userEvent.click(await screen.findByRole('button', { name: 'Duplicate Board review' }));
		await waitFor(() => expect(global.fetch.calls.some((c) => c.line === 'POST /presentations')).toBe(true));
		const body = JSON.parse(global.fetch.calls.find((c) => c.line === 'POST /presentations').init.body);
		expect(body).toMatchObject({ title: 'Copy of Board review', status: 'draft', team_id: '7' });
		expect(body.slides[0].objects[0].text).toBe('Annual numbers');
		expect(await screen.findByText('Copied as “Copy of Board review”')).toBeInTheDocument();
	});

	test('Delete asks first, then removes the deck', async () => {
		mockFetch(routes());
		renderWithProviders(<CenterRoutes />, { route: '/presentations' });
		await userEvent.click(await screen.findByRole('button', { name: 'Delete All hands' }));
		await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^Delete/ }));
		await waitFor(() => expect(global.fetch.calls.some((c) => c.line === 'DELETE /presentations/6')).toBe(true));
	});

});

// ---- viewer -----------------------------------------------------------------------------------
function PlayerRoutes() {
	return (
		<Routes>
			<Route path="/presentations/:id/present" element={<PresentationPlayer />} />
			<Route path="/presentations" element={<div>Presentation list page</div>} />
		</Routes>
	);
}
const employees = [
	{ ROWID: '11', full_name: 'Asha Rao', job_role: 'Engineer', employment_status: 'active', primary_team_id: '7', employee_code: 'E-100', joining_date: '2024-01-10', reports_to_employee_id: '12' },
	{ ROWID: '12', full_name: 'Bala Iyer', job_role: null, employment_status: 'on_leave', primary_team_id: null, employee_code: null, joining_date: null, reports_to_employee_id: null },
];
const projects = [{ ROWID: '31', project_name: 'Atlas', project_code: 'P-1', team_id: '7', current_status: 'active', project_type: 'Fixed', first_start_date: '2026-01-05', end_date: null, estimated_hours: '120' }];
const viewerRoutes = (extra = []) => [...extra, [/^GET \/presentations\/5$/, okBody(deckBody())], [/^POST \/presentations\/5\/presented/, okBody({ ROWID: '5' })], [/^GET \/employees/, okBody(employees, meta(2))], [/^GET \/projects/, okBody(projects, meta(1))], ...dashboardRoutes()];

describe('presentation viewer', () => {
	const open = async (query = '') => {
		const out = renderWithProviders(<PlayerRoutes />, { route: `/presentations/5/present${query}` });
		const dialog = await screen.findByRole('dialog', { name: 'Presentation: Board review' });
		await within(dialog).findByRole('heading', { name: 'Board review' });
		return { dialog, ...out };
	};

	test('the theme in the link is applied to the whole viewer and can be switched on the fly', async () => {
		mockFetch(viewerRoutes());
		const { dialog } = await open('?theme=sunset&people=0&records=0&reporting=0');
		expect(dialog).toHaveAttribute('data-ptheme', 'sunset');
		expect(dialog.style.getPropertyValue('--accent')).toBe(themeById('sunset').tokens['--accent']);
		await userEvent.click(within(dialog).getByRole('button', { name: /Theme: Sunset Prestige/ }));
		await userEvent.click(within(dialog).getByRole('button', { name: /Emerald Vision/ }));
		expect(dialog).toHaveAttribute('data-ptheme', 'emerald');
		expect(readStoredTheme()).toBe('emerald');
	});

	test('people overview and profile slides show real records; missing fields are marked, never invented', async () => {
		mockFetch(viewerRoutes());
		const { dialog } = await open('?theme=aurora&people=1&records=0&reporting=0');
		await userEvent.keyboard('{ArrowRight}'); // employee overview section
		await within(dialog).findByRole('heading', { name: 'Employee overview' });
		await userEvent.keyboard('{ArrowRight}'); // people overview
		expect(await within(dialog).findByRole('heading', { name: 'Team overview' })).toBeInTheDocument();
		expect(within(dialog).getByText('Asha Rao')).toBeInTheDocument();
		expect(within(dialog).getByText('Role not recorded')).toBeInTheDocument(); // Bala has no role
		expect(await within(dialog).findByText('Delivery')).toBeInTheDocument(); // team name from the real lookup
		await userEvent.keyboard('{ArrowRight}'); // first profile
		expect(await within(dialog).findByRole('heading', { name: 'Asha Rao' })).toBeInTheDocument();
		expect(within(dialog).getByText('E-100')).toBeInTheDocument();
		expect(within(dialog).getByText(/calculated/)).toBeInTheDocument(); // tenure is labelled as derived
		await userEvent.keyboard('{ArrowRight}'); // second profile: sparse record
		expect(await within(dialog).findByRole('heading', { name: 'Bala Iyer' })).toBeInTheDocument();
		expect(within(dialog).getAllByText('—').length).toBeGreaterThanOrEqual(3);
		// exactly one request each for the people list (not one per slide)
		expect(global.fetch.calls.filter((c) => c.line.startsWith('GET /employees?')).filter((c) => /page=1&pageSize=16/.test(c.line))).toHaveLength(1);
		expect(global.fetch.calls.some((c) => c.line.startsWith('GET /projects'))).toBe(false); // records option off: not fetched
	});

	test('project record slides render the real table', async () => {
		mockFetch(viewerRoutes());
		const { dialog } = await open('?theme=crystal&people=0&records=1&reporting=0');
		await userEvent.keyboard('{ArrowRight}{ArrowRight}'); // employee overview, project performance
		await within(dialog).findByRole('heading', { name: 'Project performance' });
		await userEvent.keyboard('{ArrowRight}');
		const table = await within(dialog).findByRole('table');
		expect(within(table).getByText('Atlas')).toBeInTheDocument();
		expect(within(table).getByText('P-1')).toBeInTheDocument();
		expect(within(table).getByText('120')).toBeInTheDocument();
		expect(within(table).getAllByText('—').length).toBeGreaterThanOrEqual(1); // end date not recorded
	});

	test('a failed people request shows an error slide with Retry instead of fake people', async () => {
		let fail = true;
		mockFetch(viewerRoutes([[/^GET \/employees/, () => (fail ? { status: 500, body: errBody(500, 'INTERNAL', 'Boom') } : okBody(employees, meta(2)))]]));
		const { dialog } = await open('?people=1&records=0&reporting=0');
		await userEvent.keyboard('{ArrowRight}{ArrowRight}');
		const alert = await within(dialog).findByRole('alert');
		expect(alert).toHaveTextContent(/could not be loaded/);
		expect(within(dialog).queryByText('Asha Rao')).not.toBeInTheDocument();
		fail = false;
		await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
		expect(await within(dialog).findByText('Asha Rao')).toBeInTheDocument();
	});

	test('keys advance exactly one slide, are ignored while typing, and Home/End work', async () => {
		mockFetch(viewerRoutes());
		const { dialog } = await open('?people=0&records=0&reporting=0');
		await userEvent.keyboard('{ArrowRight}');
		expect(within(dialog).getByText('Slide 2 of 4')).toBeInTheDocument(); // one press, one slide (single listener)
		await userEvent.keyboard(' ');
		expect(within(dialog).getByText('Slide 3 of 4')).toBeInTheDocument();
		const input = document.createElement('input');
		document.body.appendChild(input);
		input.focus();
		await userEvent.keyboard('{ArrowRight}{ArrowLeft}');
		expect(within(dialog).getByText('Slide 3 of 4')).toBeInTheDocument(); // typing in a field never moves slides
		input.remove();
		await userEvent.keyboard('{End}');
		expect(within(dialog).getByText('Slide 4 of 4')).toBeInTheDocument();
		await userEvent.keyboard('{ArrowLeft}');
		expect(within(dialog).getByText('Slide 3 of 4')).toBeInTheDocument();
		await userEvent.keyboard('{Home}');
		expect(within(dialog).getByText('Slide 1 of 4')).toBeInTheDocument();
		await userEvent.keyboard('{Escape}');
		expect(await screen.findByText('Presentation list page')).toBeInTheDocument();
	});

	test('previous / next buttons and the progress bar follow the slide', async () => {
		mockFetch(viewerRoutes());
		const { dialog } = await open('?people=0&records=0&reporting=0');
		expect(within(dialog).getByRole('button', { name: 'Previous slide' })).toBeDisabled();
		await userEvent.click(within(dialog).getByRole('button', { name: 'Next slide' }));
		expect(within(dialog).getByText('Slide 2 of 4')).toBeInTheDocument();
		expect(dialog.querySelector('.pres__progress i').style.width).toBe('50%');
	});

	test('the fullscreen button appears only where the browser allows it and requests fullscreen on the viewer', async () => {
		mockFetch(viewerRoutes());
		const { dialog, unmount } = await open('?people=0&records=0&reporting=0');
		expect(within(dialog).queryByRole('button', { name: /Fullscreen/ })).not.toBeInTheDocument(); // jsdom has no fullscreen support
		unmount();

		Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
		const request = jest.fn(() => Promise.resolve());
		Element.prototype.requestFullscreen = request;
		mockFetch(viewerRoutes());
		const second = await open('?people=0&records=0&reporting=0');
		await userEvent.click(within(second.dialog).getByRole('button', { name: 'Fullscreen' }));
		expect(request).toHaveBeenCalledTimes(1);
		await userEvent.keyboard('f');
		expect(request).toHaveBeenCalledTimes(2);
		delete Element.prototype.requestFullscreen;
		delete document.fullscreenEnabled;
	});

	test('the toolbar controls stay reachable and reduced motion is honoured in the stylesheet', async () => {
		mockFetch(viewerRoutes());
		const { dialog } = await open('?people=0&records=0&reporting=0');
		fireEvent.mouseMove(dialog);
		expect(dialog).toHaveAttribute('data-chrome', 'on');
		expect(within(dialog).getByRole('toolbar', { name: 'Presentation controls' })).toBeInTheDocument();
		// the stylesheet switches every presentation animation off under prefers-reduced-motion
		const css = require('fs').readFileSync(require('path').join(__dirname, '../styles/presentations.css'), 'utf8');
		expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.pslide[\s\S]*animation: none/);
	});
});
