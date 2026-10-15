import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Popover from '../components/common/Popover';
import DetailsEditor, { parseDetails, serializeDetails } from '../components/forms/DetailsEditor';
import ResourceForm from '../components/forms/ResourceForm';
import { mockFetch, okBody } from './helpers';
import { fireEvent } from '@testing-library/react';
import { ProfileSlide } from '../features/presentations/PresentationSlides';
import { buildSlides } from '../features/presentations/deckSlides';
import { cellStyle, inkFor, isHexColor, resolveFill, sanitizeCell } from '../features/spreadsheet/sheetFormat';
import { api, clearApiCache, readPolicy } from '../services/apiClient';

const okRes = (data) => ({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, data, meta: null }) });
const errRes = (status, code) => ({ ok: false, status, json: () => Promise.resolve({ ok: false, error: { code, message: 'x' } }) });

describe('read requests: retries and bounded concurrency', () => {
	const saved = { ...readPolicy };
	afterEach(() => {
		Object.assign(readPolicy, saved);
		clearApiCache();
	});

	test('a busy data service is retried quietly and the caller gets the data', async () => {
		Object.assign(readPolicy, { retries: 2, delays: [1, 1] });
		global.fetch = jest.fn().mockResolvedValueOnce(errRes(503, 'DATASTORE_THROTTLED')).mockResolvedValueOnce(errRes(504, 'DATASTORE_TIMEOUT')).mockResolvedValueOnce(okRes({ a: 1 }));
		await expect(api.get('/dashboard/overview')).resolves.toMatchObject({ data: { a: 1 } });
		expect(global.fetch).toHaveBeenCalledTimes(3);
	});

	test('errors that will not change are not retried, and retries are bounded', async () => {
		Object.assign(readPolicy, { retries: 2, delays: [1, 1] });
		global.fetch = jest.fn().mockResolvedValue(errRes(403, 'FORBIDDEN'));
		await expect(api.get('/a')).rejects.toMatchObject({ status: 403 });
		expect(global.fetch).toHaveBeenCalledTimes(1);
		global.fetch = jest.fn().mockResolvedValue(errRes(503, 'DATASTORE_THROTTLED'));
		await expect(api.get('/b')).rejects.toMatchObject({ code: 'DATASTORE_THROTTLED' });
		expect(global.fetch).toHaveBeenCalledTimes(3);
		global.fetch = jest.fn().mockResolvedValue(errRes(503, 'QUERY_BUDGET_EXCEEDED')); // a real fault, not load
		await expect(api.get('/c')).rejects.toMatchObject({ status: 503 });
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	test('writes are never retried', async () => {
		Object.assign(readPolicy, { retries: 2, delays: [1, 1] });
		global.fetch = jest.fn().mockResolvedValue(errRes(503, 'DATASTORE_THROTTLED'));
		await expect(api.post('/x', {})).rejects.toMatchObject({ status: 503 });
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	test('no more than maxParallel reads are in flight at once', async () => {
		Object.assign(readPolicy, { retries: 0, maxParallel: 2 });
		let live = 0;
		let peak = 0;
		global.fetch = jest.fn(
			() =>
				new Promise((resolve) => {
					live += 1;
					peak = Math.max(peak, live);
					setTimeout(() => {
						live -= 1;
						resolve(okRes({}));
					}, 5);
				})
		);
		await Promise.all([1, 2, 3, 4, 5, 6].map((n) => api.get(`/slow/${n}`)));
		expect(global.fetch).toHaveBeenCalledTimes(6);
		expect(peak).toBe(2);
	});
});

describe('custom spreadsheet colours', () => {
	test('only well-formed #rrggbb values are accepted', () => {
		expect(isHexColor('#a1B2c3')).toBe(true);
		['red', '#fff', '#12345g', 'url(x)', '#1234567', null].forEach((v) => expect(isHexColor(v)).toBe(false));
		expect(sanitizeCell({ fill: '#A1B2C3', color: '#000000' })).toEqual({ fill: '#a1b2c3', color: '#000000' });
		expect(sanitizeCell({ fill: 'javascript:alert(1)', color: 'red' })).toBeNull();
		expect(sanitizeCell({ fill: 'accent-soft' })).toEqual({ fill: 'accent-soft' }); // palette ids still work
	});

	test('a custom fill gets readable ink and drives the cell style', () => {
		expect(inkFor('#ffffff')).toBe('#111827');
		expect(inkFor('#ffe066')).toBe('#111827');
		expect(inkFor('#102a43')).toBe('#ffffff');
		expect(resolveFill('#102a43')).toEqual({ css: '#102a43', ink: '#ffffff' });
		expect(cellStyle({ fill: '#102a43' })).toMatchObject({ '--cell-fill': '#102a43', color: '#ffffff' });
		expect(cellStyle({ fill: '#102a43', color: '#ffe066' }).color).toBe('#ffe066'); // an explicit text colour wins
	});
});

describe('individual profile slide', () => {
	const person = { ROWID: '1', full_name: 'Asha Rao', job_role: 'Engineer', employment_status: 'active', primary_team_id: '7', joining_date: '2024-01-10' };
	const labelOf = () => 'Delivery';
	const data = {
		time: { completeness: 'partial', missing: 'pending_approval', totalMinutes: 420, billableMinutes: 300, nonBillableMinutes: 120, billablePercent: 71.4 },
		attendance: { completeness: 'complete', lateCount: 1, onTimeCount: 1, records: 2, lateRatePercent: 50 },
		leave: { completeness: 'complete', approvedDays: 2, approvedHours: 0, byStatus: { approved: 1, requested: 1 } },
		ai: { completeness: 'complete', tools: [{ tool: 'Claude', category: 'ai', records: 2, avgReportedPercent: 40 }, { tool: 'Cursor', category: 'ai', records: 1, avgReportedPercent: null }] },
		product: { completeness: 'complete', total: 2, byStatus: { open: 1, done: 1 }, byType: { bug: { open: 1 }, feature: { done: 1 } } },
		projects: { total: 3, items: [{ projectId: '1', name: 'Alpha', periodMinutes: 300 }, { projectId: '2', name: 'Beta', periodMinutes: 120 }] },
	};
	const slide = (activity) => ({ kind: 'profile', person, n: 1, of: 1, total: 1, activity });

	test('shows leave, billable and non-billable time, late check-ins, AI tools, product items and projects', () => {
		render(<ProfileSlide slide={slide({ status: 'ready', data })} labelOf={labelOf} />);
		expect(screen.getByRole('heading', { name: 'Asha Rao' })).toBeInTheDocument();
		expect(screen.getByText('Approved time')).toBeInTheDocument();
		expect(screen.getByText('5 h · 71%')).toBeInTheDocument(); // billable
		expect(screen.getAllByText('2 h').length).toBeGreaterThanOrEqual(1); // non-billable (and Beta's hours)
		expect(screen.getByText('1 of 2')).toBeInTheDocument(); // late check-ins
		expect(screen.getByText('Approved days').nextSibling).toHaveTextContent('2');
		expect(screen.getByText('Claude')).toBeInTheDocument();
		expect(screen.getByText('Items assigned').nextSibling).toHaveTextContent('2');
		expect(screen.getByText('Alpha')).toBeInTheDocument();
		expect(screen.getByText('+1 more projects')).toBeInTheDocument();
		expect(screen.getByText(/Some time entries are still pending approval/)).toBeInTheDocument();
	});

	test('missing data reads as not recorded (never 0); loading and error are explained', () => {
		const empty = { time: { completeness: 'insufficient_data' }, attendance: { completeness: 'insufficient_data' }, leave: { completeness: 'insufficient_data' }, ai: { completeness: 'insufficient_data', tools: [] }, product: { completeness: 'insufficient_data' }, projects: { total: 0, items: [] } };
		const { rerender } = render(<ProfileSlide slide={slide({ status: 'ready', data: empty })} labelOf={labelOf} />);
		expect(screen.getAllByText('No records in this period').length).toBeGreaterThanOrEqual(3);
		expect(screen.getByText('No usage reported')).toBeInTheDocument();
		expect(screen.getByText('No items assigned')).toBeInTheDocument();
		expect(screen.queryByText('0 h')).not.toBeInTheDocument();
		rerender(<ProfileSlide slide={slide({ status: 'loading' })} labelOf={labelOf} />);
		expect(screen.getAllByText('Loading…')).toHaveLength(6);
		rerender(<ProfileSlide slide={slide({ status: 'error' })} labelOf={labelOf} />);
		expect(screen.getAllByText('Could not be loaded')).toHaveLength(6);
	});

	test('the slide list attaches each person their own activity, or loading/error while it is fetched', () => {
		const deck = [{ type: 'section', section: 'employee_overview' }];
		const people = { status: 'success', data: [person, { ...person, ROWID: '2', full_name: 'Bala' }], meta: { total: 2 } };
		const profilesOf = (profiles) => buildSlides(deck, { people, wantPeople: true, profiles }).filter((s) => s.kind === 'profile').map((s) => s.activity.status);
		expect(profilesOf({ status: 'loading' })).toEqual(['loading', 'loading']);
		expect(profilesOf({ status: 'error', error: new Error('x') })).toEqual(['error', 'error']);
		expect(profilesOf({ status: 'success', data: { people: { 1: data } } })).toEqual(['ready', 'error']); // 2 has no entry: never invented
	});
});

describe('popover placement', () => {
	test('opens above the trigger when asked (controls at the bottom of the screen)', async () => {
		render(
			<Popover label="Menu" placement="up" trigger={({ toggle }) => <button onClick={toggle}>Open</button>}>
				<p>Inside</p>
			</Popover>
		);
		await userEvent.click(screen.getByRole('button', { name: 'Open' }));
		expect(screen.getByRole('group', { name: 'Menu' })).toHaveClass('popover--up');
	});
});

describe('reporting tree slide as a launcher option', () => {
	const model = { parts: [{ rootIds: ['1'], maxDepth: Infinity, kind: 'all' }] };
	const ready = { status: 'ready', model };
	const kinds = (deck, opts) => buildSlides(deck, opts).map((s) => s.kind);

	test('a deck without the section gets the slide after the employee section when asked, and nothing otherwise', () => {
		const deck = [{ type: 'section', section: 'executive_summary' }, { type: 'section', section: 'employee_overview' }, { type: 'section', section: 'ai_usage' }];
		expect(kinds(deck, {})).toEqual(['opening', 'deck', 'deck', 'deck', 'closing']);
		expect(kinds(deck, { addReporting: true, reporting: ready })).toEqual(['opening', 'deck', 'deck', 'reporting', 'deck', 'closing']);
	});

	test('without an employee section it goes just before the closing slide; no saved tree adds nothing', () => {
		const deck = [{ type: 'section', section: 'ai_usage' }];
		expect(kinds(deck, { addReporting: true, reporting: ready })).toEqual(['opening', 'deck', 'reporting', 'closing']);
		expect(kinds(deck, { addReporting: true, reporting: { status: 'ready', model: null } })).toEqual(['opening', 'deck', 'closing']);
	});

	test('a deck that already has the section is never given a second one', () => {
		const deck = [{ type: 'section', section: 'reporting_structure' }];
		expect(kinds(deck, { addReporting: true, reporting: ready }).filter((k) => k === 'reporting')).toHaveLength(1);
	});

	test('the launcher only offers it for decks that lack the section', () => {
		const { detailOptions } = require('../features/presentations/deckSlides');
		expect(detailOptions([{ type: 'section', section: 'ai_usage' }]).reporting).toBe(true);
		expect(detailOptions([{ type: 'section', section: 'reporting_structure' }]).reporting).toBe(false);
	});
});

describe('plain-language forms', () => {
	test('extra details are edited as name / value rows and stored as the same JSON underneath', async () => {
		const onChange = jest.fn();
		render(<DetailsEditor id="x" value={'{"Desk":"B-12","Floor":3}'} onChange={onChange} />);
		expect(screen.getByLabelText('Detail 1 name')).toHaveValue('Desk');
		expect(screen.getByLabelText('Detail 2 value')).toHaveValue('3');
		await userEvent.clear(screen.getByLabelText('Detail 1 value'));
		await userEvent.type(screen.getByLabelText('Detail 1 value'), 'C-4');
		expect(JSON.parse(onChange.mock.calls.at(-1)[0])).toEqual({ Desk: 'C-4', Floor: 3 }); // an untouched number stays a number
		await userEvent.click(screen.getByRole('button', { name: 'Add a detail' }));
		await userEvent.type(screen.getByLabelText('Detail 3 name'), 'Badge');
		await userEvent.type(screen.getByLabelText('Detail 3 value'), '77');
		expect(JSON.parse(onChange.mock.calls.at(-1)[0])).toMatchObject({ Badge: '77' });
		await userEvent.click(screen.getByRole('button', { name: 'Remove detail 1' }));
		expect(JSON.parse(onChange.mock.calls.at(-1)[0])).not.toHaveProperty('Desk');
	});

	test('details that are not a simple list are kept untouched and never shown as raw JSON', () => {
		expect(parseDetails('{"a":{"b":1}}').advanced).toBe(true);
		expect(parseDetails('not json').advanced).toBe(true);
		expect(parseDetails('').rows).toEqual([]);
		const onChange = jest.fn();
		render(<DetailsEditor id="x" value={'{"a":{"b":1}}'} onChange={onChange} />);
		expect(screen.getByText(/kept exactly as it is/)).toBeInTheDocument();
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
		expect(serializeDetails([{ name: '  ', value: 'x' }])).toBe('');
	});
});

describe('date and time fields', () => {
	test('a date-time picker replaces typing YYYY-MM-DD HH:mm:ss; the stored text format is unchanged', async () => {
		mockFetch([[/^POST \/attendance/, { status: 201, body: okBody({ ROWID: '1' }) }]]);
		const onSaved = jest.fn();
		render(<ResourceForm resource="attendance_records" template={{ columns: [{ field: 'check_in_time_local', type: 'datetime', required: false }], immutable: [] }} onSaved={onSaved} onCancel={() => {}} />);
		const input = screen.getByLabelText(/Check in time local/i);
		expect(input).toHaveAttribute('type', 'datetime-local');
		fireEvent.change(input, { target: { value: '2026-10-05T09:15' } });
		await userEvent.click(screen.getByRole('button', { name: 'Create' }));
		await screen.findByRole('form', { name: 'New record' }).catch(() => null);
		const call = global.fetch.calls.find((c) => c.line.startsWith('POST'));
		expect(JSON.parse(call.init.body)).toEqual({ check_in_time_local: '2026-10-05 09:15:00' });
	});
});
