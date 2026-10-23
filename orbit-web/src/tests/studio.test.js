import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { zipSync, strToU8 } from 'fflate';
import PresentationPlayer from '../features/presentations/PresentationPlayer';
import SlideCanvas from '../features/presentations/studio/SlideCanvas';
import StudioEditor from '../features/presentations/studio/StudioEditor';
import StudioStart from '../features/presentations/studio/StudioStart';
import { listUserTemplates, removeUserTemplate, saveUserTemplate, slidesOfUserTemplate } from '../features/presentations/studio/userTemplates';
import WidgetView from '../features/presentations/studio/WidgetView';
import { importPptx } from '../features/presentations/studio/pptxImport';
import { CANVAS_H, CANVAS_W, colorCss, makeText, makeSlide, makeWidget, moveObject, resizeObject, slideSteps } from '../features/presentations/studio/slideModel';
import { snapBox } from '../features/presentations/studio/Stage';
import { TEMPLATE_LIST, deckFromTemplate } from '../features/presentations/studio/templates';
import { deltaOf, kpiOf, previousRange, widgetModel, widgetSections } from '../features/presentations/studio/widgetData';
import { dashboardRoutes, highlightsFixture, mockFetch, okBody, projectsFixture, renderWithProviders } from './helpers';

jest.setTimeout(20000);

const COLOR = /^(#[0-9a-fA-F]{3,8}|theme:[a-z0-9]{2,12}|transparent)$/;

describe('studio model', () => {
	test('moving and resizing keep a minimum size and whole numbers', () => {
		const o = { x: 100, y: 100, w: 300, h: 200 };
		expect(moveObject(o, 10.4, -20.6)).toMatchObject({ x: 110, y: 79 });
		expect(resizeObject(o, 'se', 50, 25)).toMatchObject({ w: 350, h: 225 });
		expect(resizeObject(o, 'nw', 40, 30)).toMatchObject({ x: 140, y: 130, w: 260, h: 170 });
		expect(resizeObject(o, 'e', -9999, 0).w).toBe(24);
		expect(resizeObject(o, 'se', 100, 0, true)).toMatchObject({ w: 400, h: 267 }); // ratio kept
	});

	test('colours: theme keywords map to the theme, hex stays, anything else is transparent', () => {
		expect(colorCss('theme:accent')).toBe('var(--accent)');
		expect(colorCss('#abc123')).toBe('#abc123');
		expect(colorCss('red; background:url(x)')).toBe('transparent');
		expect(colorCss(undefined, '#000')).toBe('#000');
	});

	test('a slide needs as many clicks as its highest "on click" step', () => {
		expect(slideSteps(makeSlide({ objects: [makeText({ anim: { in: 'fade', step: 2 } }), makeText({ anim: { in: 'fade', step: 1 } }), makeText()] }))).toBe(2);
		expect(slideSteps(makeSlide())).toBe(0);
	});

	test('snapping pulls a box to the slide centre and to other objects, and says where the guide goes', () => {
		const near = snapBox({ x: 860, y: 100, w: 200, h: 100 }, [], 1); // centre x is 960
		expect(near.box.x).toBe(860);
		expect(near.guides.some((g) => g.orient === 'v' && g.pos === 960)).toBe(true);
		const edge = snapBox({ x: 5, y: 500, w: 100, h: 50 }, [], 1);
		expect(edge.box.x).toBe(0);
		const other = snapBox({ x: 403, y: 700, w: 100, h: 50 }, [{ x: 400, y: 0, w: 50, h: 50 }], 1);
		expect(other.box.x).toBe(400);
		expect(snapBox({ x: 500, y: 300, w: 100, h: 50 }, [], 1).guides).toEqual([]);
	});
});

describe('design templates', () => {
	test.each(TEMPLATE_LIST.map((t) => [t.id]))('%s is a clean, complete deck the server will accept', (id) => {
		const slides = deckFromTemplate(id);
		expect(slides.length).toBeGreaterThanOrEqual(5);
		const ids = new Set();
		for (const s of slides) {
			expect(s.type).toBe('custom');
			expect(s.objects.length).toBeLessThanOrEqual(40);
			expect(COLOR.test(s.bg.color)).toBe(true);
			for (const o of s.objects) {
				expect(ids.has(o.id)).toBe(false);
				ids.add(o.id);
				for (const c of [o.st && o.st.color, o.st && o.st.fill, o.st && o.st.fill2, o.st && o.st.bc].filter(Boolean)) expect(COLOR.test(c)).toBe(true);
				expect(o.w).toBeGreaterThan(0);
				expect(o.h).toBeGreaterThan(0);
			}
		}
		// the designs are plain: no glow or gradient decoration, only flat shapes
		expect(slides.flatMap((s) => s.objects).filter((o) => o.kind === 'shape' && o.st.fill2)).toHaveLength(0);
	});

	test('the six designs differ from each other', () => {
		expect(new Set(TEMPLATE_LIST.map((t) => t.bg + t.accent)).size).toBeGreaterThanOrEqual(5);
	});
});

describe('slide canvas', () => {
	const slide = makeSlide({
		bg: { kind: 'solid', color: '#101820' },
		objects: [
			makeText({ id: 'a', text: 'Hello', link: 'https://example.com/x', hover: 'lift', anim: { in: 'rise', delay: 100, dur: 500, step: 0 } }),
			makeText({ id: 'b', text: 'Second', anim: { in: 'fade', delay: 0, dur: 400, step: 1 } }),
			makeText({ id: 'c', text: 'Jump', link: '#slide-3' }),
		],
	});

	test('draws the objects, animates them in and opens links in a new tab safely', () => {
		const { container } = render(<SlideCanvas slide={slide} step={0} />);
		expect(container.querySelector('.sx')).toHaveStyle({ width: `${CANVAS_W}px`, height: `${CANVAS_H}px` });
		const link = screen.getByRole('link', { name: 'Hello' });
		expect(link).toHaveAttribute('href', 'https://example.com/x');
		expect(link).toHaveAttribute('target', '_blank');
		expect(link.getAttribute('rel')).toMatch(/noopener/);
		expect(container.querySelector('[data-oid="a"] .sx-in--rise')).toHaveStyle({ animationDelay: '100ms' });
		expect(container.querySelector('[data-oid="a"] .sx-hv--lift')).toBeInTheDocument();
	});

	test('an "on click" object stays hidden until its step', () => {
		const { container, rerender } = render(<SlideCanvas slide={slide} step={0} />);
		expect(container.querySelector('[data-oid="b"]')).toHaveStyle({ visibility: 'hidden' });
		rerender(<SlideCanvas slide={slide} step={1} />);
		expect(container.querySelector('[data-oid="b"]')).not.toHaveStyle({ visibility: 'hidden' });
	});

	test('an in-deck link jumps instead of navigating, and editing makes links inert', async () => {
		const onJump = jest.fn();
		const { rerender } = render(<SlideCanvas slide={slide} onJump={onJump} />);
		await userEvent.click(screen.getByRole('link', { name: 'Jump' }));
		expect(onJump).toHaveBeenCalledWith(2);
		rerender(<SlideCanvas slide={slide} editing />);
		expect(screen.queryByRole('link')).not.toBeInTheDocument();
	});
});

describe('widget data', () => {
	const ok = (data) => ({ status: 'success', data });
	const overview = { time: { billableMinutes: 600, nonBillableMinutes: 300, totalMinutes: 900, billablePercent: 66.7, completeness: 'partial' }, attendance: { lateRatePercent: 25, completeness: 'complete' }, leave: { approvedDays: 3 }, headcount: { total: 12, byStatus: { active: 11, on_leave: 1 }, completeness: 'complete' } };
	const data = { overview: ok(overview), projects: ok(projectsFixture), highlights: ok(highlightsFixture), trends: ok({ time: [{ start: '2026-10-05', billableMinutes: 300 }, { start: '2026-10-12', billableMinutes: 600 }], attendance: [] }) };

	test('big numbers come from backend metrics and a missing figure stays missing', () => {
		expect(kpiOf('billable_hours', overview)).toMatchObject({ value: 10, unit: 'h' });
		expect(kpiOf('late_rate', overview)).toMatchObject({ value: 25, unit: '%', lowerIsBetter: true });
		expect(kpiOf('headcount', { headcount: { total: null } }).value).toBeNull();
		expect(kpiOf('headcount', {})).toBeNull();
	});

	test('the change on the previous period: up, down, and unknown without a base', () => {
		expect(deltaOf(120, 100)).toEqual({ pct: 20, dir: 'up', good: true });
		expect(deltaOf(8, 10, true)).toMatchObject({ dir: 'down', good: true }); // a lower late rate is good
		expect(deltaOf(5, 0)).toBeNull();
		expect(deltaOf(null, 3)).toBeNull();
		expect(previousRange({ from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: '2026-08-31', to: '2026-09-30' });
	});

	test('each widget type gets the shape it draws', () => {
		expect(widgetModel({ type: 'kpi', metric: 'billable_hours', compare: true }, data, ok({ time: { billableMinutes: 300 } })).delta).toMatchObject({ pct: 100, dir: 'up' });
		expect(widgetModel({ type: 'bars', metric: 'workload', top: 1 }, data).items.map((i) => [i.label, i.value])).toEqual([['Alpha', 5]]);
		expect(widgetModel({ type: 'donut', metric: 'headcount' }, data).items.map((i) => [i.label, i.pct])).toEqual([['Active', 91.7], ['On leave', 8.3]]);
		expect(widgetModel({ type: 'trend', metric: 'billable_hours' }, data).series.map((p) => p.value)).toEqual([5, 10]);
		expect(widgetModel({ type: 'leaders', metric: 'top_performers', top: 5 }, data).items.map((i) => i.label)).toEqual(['Asha Rao', 'Bala Kumar']);
		expect(widgetModel({ type: 'kpi', metric: 'billable_hours' }, { overview: { status: 'loading' } }).status).toBe('loading');
		expect(widgetModel({ type: 'kpi', metric: 'billable_hours' }, { overview: { status: 'error' } }).status).toBe('error');
	});

	test('a deck fetches only the datasets its widgets use', () => {
		const slides = [makeSlide({ objects: [makeWidget('kpi', { widget: { type: 'kpi', metric: 'late_rate' } }), makeWidget('bars')] }), { type: 'section', section: 'ai_usage' }];
		expect(widgetSections(slides).sort()).toEqual(['overview', 'projects', 'trends']);
	});

	test('the widgets draw their figures and a hover reveals detail', async () => {
		const o = makeWidget('bars', { widget: { type: 'bars', metric: 'workload', top: 5, compare: false } });
		render(<WidgetView o={o} data={data} />);
		expect(screen.getByText('Alpha')).toBeInTheDocument();
		expect(screen.getByText('5 h')).toBeInTheDocument();
		expect(screen.getByText(/of the 10 h estimate/)).toBeInTheDocument();
		const donut = makeWidget('donut', { widget: { type: 'donut', metric: 'headcount' } });
		render(<WidgetView o={donut} data={data} />);
		await userEvent.hover(screen.getByText('Active'));
		expect(screen.getAllByText(/Active · 91.7%/).length).toBeGreaterThan(0);
	});
});

describe('the player with a studio deck', () => {
	const slides = [
		makeSlide({ id: 's1', objects: [makeText({ id: 't1', text: 'Opening words' }), makeText({ id: 't2', text: 'Revealed later', anim: { in: 'fade', step: 1, delay: 0, dur: 300 } })] }),
		makeSlide({ id: 's2', objects: [makeText({ id: 't3', text: 'Second slide' }), makeWidget('kpi', { widget: { type: 'kpi', metric: 'billable_hours', compare: false } })] }),
	];
	const deck = { ROWID: '9', title: 'Studio deck', team_id: '7', status: 'ready', slidesAvailable: true, slides, config: { v: 2, period: { preset: 'this_month' }, filters: { teamId: '7', projectId: null }, slides } };
	const routes = () => [[/^GET \/presentations\/9$/, okBody(deck)], [/^POST \/presentations\/9\/presented/, okBody({ ROWID: '9' })], ...dashboardRoutes()];
	const Player = () => (
		<Routes>
			<Route path="/presentations/:id/present" element={<PresentationPlayer />} />
		</Routes>
	);

	test('no generated cover or closing, Next reveals the click steps first, then the next slide, and widgets show live numbers', async () => {
		mockFetch(routes());
		renderWithProviders(<Player />, { route: '/presentations/9/present' });
		const dialog = await screen.findByRole('dialog', { name: 'Presentation: Studio deck' });
		expect(await within(dialog).findByText('Opening words')).toBeInTheDocument();
		expect(within(dialog).getByText('Slide 1 of 2')).toBeInTheDocument(); // a studio deck brings its own cover
		expect(within(dialog).getByText('Revealed later').closest('.sx__obj')).toHaveStyle({ visibility: 'hidden' });
		await userEvent.keyboard('{ArrowRight}');
		expect(within(dialog).getByText('Revealed later').closest('.sx__obj')).not.toHaveStyle({ visibility: 'hidden' });
		expect(within(dialog).getByText('Slide 1 of 2')).toBeInTheDocument();
		await userEvent.keyboard('{ArrowRight}');
		expect(await within(dialog).findByText('Second slide')).toBeInTheDocument();
		expect(await within(dialog).findByText(/Billable hours/i)).toBeInTheDocument();
		await waitFor(() => expect(within(dialog).getByText('Slide 2 of 2')).toBeInTheDocument());
		expect(global.fetch.calls.some((c) => c.line.startsWith('GET /dashboard/overview'))).toBe(true);
	});
});

describe('the studio editor', () => {
	const Editor = () => (
		<Routes>
			<Route path="/presentations/studio" element={<StudioEditor />} />
			<Route path="/presentations/:id/edit" element={<StudioEditor />} />
			<Route path="/presentations" element={<div>list</div>} />
		</Routes>
	);
	const routes = (extra = []) => [...extra, [/^POST \/presentations$/, { status: 201, body: okBody({ ROWID: '21' }) }], [/^PATCH \/presentations\/21/, okBody({ ROWID: '21' })], [/^GET \/presentations\/21$/, okBody({ ROWID: '21', title: 'Quarterly review', slidesAvailable: true, config: { v: 2, period: { preset: 'this_month' }, filters: {}, slides: [] }, slides: [] })], ...dashboardRoutes()];
	const open = async (query = '?tpl=boardroom') => {
		mockFetch(routes());
		const out = renderWithProviders(<Editor />, { route: `/presentations/studio${query}` });
		await screen.findByRole('navigation', { name: 'Slides' });
		return out;
	};

	test('starts from a design: six slides in the rail, the first one on the stage, nothing saved yet', async () => {
		await open();
		expect(screen.getByRole('textbox', { name: 'Presentation title' })).toHaveValue('Quarterly review');
		expect(within(screen.getByRole('navigation', { name: 'Slides' })).getAllByRole('button', { name: /^Slide \d/ })).toHaveLength(6);
		expect(screen.getByRole('application', { name: 'Slide editing area' })).toBeInTheDocument();
		expect(global.fetch.calls.some((c) => c.line.startsWith('POST'))).toBe(false);
	});

	test('add text, change it in the panel, undo and redo, delete with the keyboard', async () => {
		await open('?tpl=blank');
		const hits = () => screen.getAllByTestId(/^hit-/);
		const before = hits().length;
		await userEvent.click(screen.getByRole('button', { name: 'Text' }));
		expect(hits()).toHaveLength(before + 1);
		expect(await screen.findByRole('textbox', { name: 'Edit text' })).toBeInTheDocument(); // a new text box opens for typing
		await userEvent.keyboard('{Escape}');
		await userEvent.click(hits()[before]);
		const size = screen.getByRole('spinbutton', { name: 'Font size' });
		await userEvent.clear(size);
		await userEvent.type(size, '90');
		expect(size).toHaveValue(90);
		await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
		expect(screen.getByRole('spinbutton', { name: 'Font size' })).not.toHaveValue(90);
		await userEvent.click(screen.getByRole('button', { name: 'Redo' }));
		expect(screen.getByRole('spinbutton', { name: 'Font size' })).toHaveValue(90);
		await userEvent.click(hits()[before]);
		await userEvent.keyboard('{Delete}');
		expect(hits()).toHaveLength(before);
	});

	test('slides can be added, duplicated, reordered and removed', async () => {
		await open('?tpl=blank');
		const rail = screen.getByRole('navigation', { name: 'Slides' });
		const count = () => within(rail).getAllByRole('button', { name: /^Slide \d/ }).length;
		await userEvent.click(within(rail).getByRole('button', { name: 'New slide' }));
		expect(count()).toBe(2);
		await userEvent.click(within(rail).getByRole('button', { name: 'Duplicate slide' }));
		expect(count()).toBe(3);
		await userEvent.click(within(rail).getByRole('button', { name: 'Move slide up' }));
		await userEvent.click(within(rail).getByRole('button', { name: 'Delete slide' }));
		expect(count()).toBe(2);
	});

	test('saving creates the presentation with its slides, then edits update the same one', async () => {
		await open();
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));
		await waitFor(() => expect(global.fetch.calls.some((c) => c.line === 'POST /presentations')).toBe(true));
		const body = JSON.parse(global.fetch.calls.find((c) => c.line === 'POST /presentations').init.body);
		expect(body.title).toBe('Quarterly review');
		expect(body.slides).toHaveLength(6);
		expect(body.slides[0].type).toBe('custom');
		expect(body.slides[1].objects.some((o) => o.kind === 'widget')).toBe(true);
	});

	test('the Live data menu adds a widget that shows real numbers', async () => {
		await open('?tpl=blank');
		await userEvent.click(screen.getByRole('button', { name: 'Live data' }));
		await userEvent.click(await screen.findByRole('button', { name: /Big number/ }));
		expect(await screen.findByLabelText('Widget type')).toBeInTheDocument();
		await waitFor(() => expect(global.fetch.calls.some((c) => c.line.startsWith('GET /dashboard/overview'))).toBe(true));
	});
});

describe('audit fixes', () => {
	const noteSlides = [makeSlide({ id: 's1', notes: 'Say hello first', objects: [makeText({ id: 't1', text: 'One', anim: { in: 'fade', step: 1, delay: 0, dur: 300 } })] })];
	const deckN = { ROWID: '9', title: 'Notes deck', team_id: '7', status: 'ready', slidesAvailable: true, slides: noteSlides, config: { v: 2, period: { preset: 'this_month' }, filters: { teamId: '7', projectId: null }, slides: noteSlides } };
	const Player = () => (
		<Routes>
			<Route path="/presentations/:id/present" element={<PresentationPlayer />} />
			<Route path="/presentations" element={<div>list</div>} />
		</Routes>
	);

	test('the player tells how many clicks are left on a slide and shows speaker notes on N', async () => {
		mockFetch([[/^GET \/presentations\/9$/, okBody(deckN)], [/^POST \/presentations\/9\/presented/, okBody({ ROWID: '9' })], ...dashboardRoutes()]);
		renderWithProviders(<Player />, { route: '/presentations/9/present' });
		const dialog = await screen.findByRole('dialog', { name: 'Presentation: Notes deck' });
		expect(await within(dialog).findByText(/click for the next \(1 more on this slide\)/)).toBeInTheDocument();
		expect(within(dialog).queryByLabelText('Speaker notes')).not.toBeInTheDocument();
		await userEvent.keyboard('n');
		expect(within(dialog).getByLabelText('Speaker notes')).toHaveTextContent('Say hello first');
		await userEvent.keyboard('{ArrowRight}');
		expect(within(dialog).queryByText(/click for the next/)).not.toBeInTheDocument();
	});

	test('a presentation that does not exist says so plainly, with a way back', async () => {
		mockFetch([[/^GET \/presentations\/9$/, { status: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } } }]]);
		renderWithProviders(<Player />, { route: '/presentations/9/present' });
		expect(await screen.findByRole('heading', { name: 'This presentation does not exist' })).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: 'Back to presentations' }));
		expect(await screen.findByText('list')).toBeInTheDocument();
	});

	const Editor = () => (
		<Routes>
			<Route path="/presentations/studio" element={<StudioEditor />} />
			<Route path="/presentations/:id/edit" element={<StudioEditor />} />
			<Route path="/presentations" element={<div>list</div>} />
		</Routes>
	);
	const editorRoutes = () => [[/^POST \/presentations$/, { status: 201, body: okBody({ ROWID: '21' }) }], ...dashboardRoutes()];

	test('Ctrl+S saves, and leaving with unsaved changes asks first', async () => {
		mockFetch(editorRoutes());
		renderWithProviders(<Editor />, { route: '/presentations/studio?tpl=blank' });
		await screen.findByRole('navigation', { name: 'Slides' });
		await userEvent.click(screen.getByRole('button', { name: 'Text' }));
		await userEvent.keyboard('{Escape}');
		await userEvent.click(screen.getByRole('button', { name: /^Presentations/ }));
		expect(await screen.findByText('Leave without saving?')).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		await userEvent.keyboard('{Control>}s{/Control}');
		await waitFor(() => expect(global.fetch.calls.some((c) => c.line === 'POST /presentations')).toBe(true));
	});

	test('a new object lands in the middle of the slide and never exactly on top of the last one', async () => {
		mockFetch(editorRoutes());
		renderWithProviders(<Editor />, { route: '/presentations/studio?tpl=blank' });
		await screen.findByRole('navigation', { name: 'Slides' });
		await userEvent.click(screen.getByRole('button', { name: 'Shape' }));
		await userEvent.click(await screen.findByRole('button', { name: 'Circle' }));
		await userEvent.click(screen.getByRole('button', { name: 'Shape' }));
		await userEvent.click(await screen.findByRole('button', { name: 'Circle' }));
		const xs = screen.getAllByTestId(/^hit-/).map((h) => h.style.left);
		expect(new Set(xs.slice(-2)).size).toBe(2);
	});
});

describe('PowerPoint import', () => {
	const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
	const presentation = `<?xml version="1.0"?><p:presentation ${NS}><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`;
	const presRels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>';
	const theme = `<a:theme ${NS}><a:themeElements><a:clrScheme name="x"><a:dk1><a:srgbClr val="111111"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="222233"/></a:dk2><a:lt2><a:srgbClr val="EEEEEE"/></a:lt2><a:accent1><a:srgbClr val="1F6FEB"/></a:accent1></a:clrScheme><a:fontScheme name="f"><a:majorFont><a:latin typeface="Georgia"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`;
	const slide1 = `<p:sld ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></p:bgPr></p:bg><p:spTree>
		<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="1219200" y="1371600"/><a:ext cx="9753600" cy="1371600"/></a:xfrm></p:spPr><p:txBody><a:bodyPr anchor="ctr"/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="4400" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>Annual review</a:t></a:r></a:p></p:txBody></p:sp>
		<p:sp><p:nvSpPr><p:cNvPr id="3" name="Box"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="609600" y="5486400"/><a:ext cx="3048000" cy="457200"/></a:xfrm><a:prstGeom prst="roundRect"/><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="1800"/><a:t>Prepared by Finance</a:t></a:r></a:p></p:txBody></p:sp>
		<p:sp><p:nvSpPr><p:cNvPr id="4" name="Footer"/><p:cNvSpPr/><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>1</a:t></a:r></a:p></p:txBody></p:sp>
		<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="5" name="Table"/></p:nvGraphicFramePr></p:graphicFrame>
	</p:spTree></p:cSld></p:sld>`;
	const slide2 = `<p:sld ${NS}><p:cSld><p:spTree><p:grpSp><p:nvGrpSpPr><p:cNvPr id="9" name="g"/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="6096000" cy="3429000"/><a:chOff x="0" y="0"/><a:chExt cx="12192000" cy="6858000"/></a:xfrm></p:grpSpPr>
		<p:sp><p:nvSpPr><p:cNvPr id="10" name="Inner"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="6096000" y="3429000"/><a:ext cx="6096000" cy="3429000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="2000" i="1"/><a:t>Grouped text</a:t></a:r></a:p></p:txBody></p:sp>
	</p:grpSp></p:spTree></p:cSld></p:sld>`;
	const build = (name = 'deck.pptx') => {
		const zip = zipSync({
			'ppt/presentation.xml': strToU8(presentation),
			'ppt/_rels/presentation.xml.rels': strToU8(presRels),
			'ppt/theme/theme1.xml': strToU8(theme),
			'ppt/slides/slide1.xml': strToU8(slide1),
			'ppt/slides/slide2.xml': strToU8(slide2),
		});
		return new File([zip], name, { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
	};

	test('text, shapes, colours and positions come across as editable objects, scaled to the slide canvas', async () => {
		const out = await importPptx(build());
		expect(out.slides).toHaveLength(2);
		expect(out.title).toBe('Annual review');
		const s1 = out.slides[0];
		expect(s1.bg).toEqual({ kind: 'solid', color: '#0f172a' });
		const title = s1.objects.find((o) => o.text === 'Annual review');
		expect(title).toMatchObject({ kind: 'text', x: 192, y: 216, w: 1536, h: 216 });
		expect(title.st).toMatchObject({ fw: 700, al: 'center', va: 'middle', color: '#ffffff' });
		expect(title.st.fs).toBe(Math.round(44 * 12700 * (1920 / 12192000)));
		const shape = s1.objects.find((o) => o.kind === 'shape');
		expect(shape.st.fill).toBe('#1f6feb'); // from the theme's accent colour
		expect(s1.objects.some((o) => o.kind === 'text' && o.text === 'Prepared by Finance')).toBe(true);
		expect(s1.objects.some((o) => o.text === '1')).toBe(false); // slide numbers are left out
		expect(out.report.skipped).toBe(1); // the table
	});

	test('groups are unpacked into slide positions', async () => {
		const out = await importPptx(build());
		const inner = out.slides[1].objects.find((o) => o.text === 'Grouped text');
		expect(inner).toMatchObject({ x: 480, y: 270 });
		expect(inner.st.it).toBe(true);
	});

	test('entrance animations, "on click" steps, theme colours, fonts and layouts are extracted too', async () => {
		const timing = '<p:timing><p:tnLst><p:par><p:cTn id="1"><p:childTnLst><p:cTn id="5" presetID="10" presetClass="entr" presetSubtype="0" nodeType="clickEffect"><p:tgtEl><p:spTgt spid="2"/></p:tgtEl></p:cTn><p:cTn id="6" presetID="2" presetClass="entr" presetSubtype="8" nodeType="withEffect"><p:tgtEl><p:spTgt spid="3"/></p:tgtEl></p:cTn></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>';
		const withTiming = slide1.replace('</p:cSld>', '</p:cSld>' + timing);
		const zip = zipSync({ 'ppt/presentation.xml': strToU8(presentation), 'ppt/_rels/presentation.xml.rels': strToU8(presRels), 'ppt/theme/theme1.xml': strToU8(theme), 'ppt/slides/slide1.xml': strToU8(withTiming), 'ppt/slides/slide2.xml': strToU8(slide2) });
		const out = await importPptx(new File([zip], 'animated.pptx'));
		const title = out.slides[0].objects.find((o) => o.text === 'Annual review');
		expect(title.anim).toMatchObject({ in: 'fade', step: 1 });
		const box = out.slides[0].objects.find((o) => o.kind === 'shape');
		expect(box.anim).toMatchObject({ in: 'left', step: 1 }); // "with previous": the same click
		expect(out.report).toMatchObject({ animations: 3, clicks: 1 });
		expect(out.report.palette).toContain('#1f6feb');
		expect(out.report.fonts).toEqual({ heading: 'Georgia', body: 'Calibri' });
	});

	test('the start page shows what was found, warns about what was not imported, and AI buttons say AI is not connected', async () => {
		window.localStorage.removeItem('company360.studioTemplates');
		renderWithProviders(<StudioStart />);
		const input = await screen.findByLabelText('PowerPoint file');
		await userEvent.upload(input, build('quarter.pptx'));
		const dialog = await screen.findByRole('dialog', { name: 'Imported from PowerPoint' });
		expect(within(dialog).getByText(/2 slides are ready to edit/)).toBeInTheDocument();
		expect(within(dialog).getByText('Theme colours')).toBeInTheDocument();
		expect(within(dialog).getByRole('alert')).toHaveTextContent(/could not be imported/);
		await userEvent.click(within(dialog).getByRole('button', { name: /Improve with AI/ }));
		expect(await screen.findByText('AI is not connected')).toBeInTheDocument();
		expect(screen.getByText(/needs an AI provider/)).toBeInTheDocument();
	});

	test('anything that is not a readable .pptx is refused with a clear message', async () => {
		await expect(importPptx(new File(['x'], 'notes.txt'))).rejects.toThrow(/\.pptx/);
		await expect(importPptx(new File(['not a zip'], 'broken.pptx'))).rejects.toThrow(/not a readable/);
	});
});

describe('your templates and the start page', () => {
	beforeEach(() => window.localStorage.removeItem('company360.studioTemplates'));

	test('a saved template is a copy with fresh ids, only editable slides are kept, and it can be removed', () => {
		const deck = deckFromTemplate('paper');
		const t = saveUserTemplate('Finance pack', [...deck, { type: 'section', section: 'ai_usage' }]);
		expect(t.slides).toHaveLength(deck.length); // the live report slide is not a design
		expect(t.slides[0].id).not.toBe(deck[0].id);
		expect(listUserTemplates().map((x) => x.name)).toEqual(['Finance pack']);
		const used = slidesOfUserTemplate(t.id);
		expect(used.title).toBe('Finance pack');
		expect(used.slides[0].objects[0].id).not.toBe(t.slides[0].objects[0].id);
		expect(saveUserTemplate('x', [{ type: 'section', section: 'ai_usage' }])).toBeNull();
		removeUserTemplate(t.id);
		expect(listUserTemplates()).toEqual([]);
	});

	test('the start page offers the designs, a blank deck, a PowerPoint file and the quick report deck, plus saved templates', async () => {
		saveUserTemplate('Finance pack', deckFromTemplate('mono'));
		renderWithProviders(<StudioStart />);
		expect((await screen.findAllByRole('listitem')).length).toBeGreaterThanOrEqual(TEMPLATE_LIST.length + 1);
		for (const name of ['Boardroom', 'Paper', 'Blueprint', 'Slate', 'Sunrise', 'Mono']) expect(screen.getByText(name)).toBeInTheDocument();
		expect(screen.getByText('Finance pack')).toBeInTheDocument();
		expect(screen.getByText('Blank presentation')).toBeInTheDocument();
		expect(screen.getByText('Use a PowerPoint file')).toBeInTheDocument();
		expect(screen.getByText('Quick report deck')).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: 'Remove template Finance pack' }));
		expect(screen.queryByText('Finance pack')).not.toBeInTheDocument();
	});
});

// keep act referenced for React 19 test environments that warn on unwrapped timers
void act;
