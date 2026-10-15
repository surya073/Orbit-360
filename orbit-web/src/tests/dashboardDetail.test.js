import React from 'react';
import { render, screen, within } from '@testing-library/react';
import KpiCard from '../components/cards/KpiCard';
import ProgressBar from '../components/charts/ProgressBar';
import RingGauge from '../components/charts/RingGauge';
import Sparkline from '../components/charts/Sparkline';
import { DASHBOARD_WIDGETS, DEFAULT_ORDER } from '../config/dashboardLayout';
import DashboardPage from '../features/dashboard/DashboardPage';
import { insightLink } from '../features/dashboard/insightLinks';
import { dashboardRoutes, manager, mockFetch, okBody, overviewFixture, renderWithProviders } from './helpers';

beforeEach(() => {
	window.localStorage.clear();
});
afterEach(() => {
	delete global.fetch;
});

describe('dashboard chart parts', () => {
	test('a sparkline needs two real points and leaves gaps for missing values', () => {
		const { container, rerender } = render(<Sparkline values={[3]} />);
		expect(container.querySelector('svg')).toBeNull();
		rerender(<Sparkline values={[null, 4]} />);
		expect(container.querySelector('svg')).toBeNull();
		rerender(<Sparkline values={[1, 4, null, 2, 6]} />);
		expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
		expect(container.querySelectorAll('.spark__line')).toHaveLength(2); // the gap splits the line in two
	});

	test('a ring gauge shows a dash and no arc without data, and flags an over-run', () => {
		const { container, rerender } = render(<RingGauge value={null} caption="billable" />);
		expect(screen.getByRole('img')).toHaveAttribute('aria-label', expect.stringContaining('no data'));
		expect(container.querySelector('.ring__arc')).toBeNull();
		expect(screen.getByText('—')).toBeInTheDocument();
		rerender(<RingGauge value={66.7} caption="billable" />);
		expect(screen.getByText('67%')).toBeInTheDocument();
		expect(container.querySelector('.ring__arc')).toHaveAttribute('stroke', 'var(--chart-1)');
		rerender(<RingGauge value={140} display="140%" />);
		expect(container.querySelector('.ring__arc')).toHaveAttribute('stroke', 'var(--chart-5)');
	});

	test('a missing progress value draws an empty track, not a zero-length bar', () => {
		const { container, rerender } = render(<ProgressBar value={null} max={150} marker={100} />);
		expect(container.querySelector('.progress__fill')).toBeNull();
		expect(container.querySelector('.progress__marker').style.left).toBe('66.66666666666666%');
		rerender(<ProgressBar value={75} max={150} />);
		expect(container.querySelector('.progress__fill').style.width).toBe('50%');
	});

	test('a KPI card only links onward when asked to, and keeps its dash for missing values', () => {
		const { rerender } = render(<KpiCard label="Billable hours" value={null} hint="Approved entries only." />);
		expect(screen.queryByRole('link')).not.toBeInTheDocument();
		expect(screen.getByText('—')).toBeInTheDocument();
		expect(screen.getByText('Approved entries only.')).toBeInTheDocument();
		rerender(<KpiCard label="Billable hours" value={null} loading hint="x" />);
		expect(screen.queryByText('x')).not.toBeInTheDocument(); // nothing is described while loading
	});

	test('findings map to the page that owns them; unknown ones do not link anywhere', () => {
		expect(insightLink('pending-approval')).toBe('/time-entries');
		expect(insightLink('over-12')).toBe('/projects');
		expect(insightLink('overdue')).toBe('/product-development');
		expect(insightLink('billable-share')).toBeNull();
	});

	test('the new widgets are part of the customisable layout', () => {
		expect(DEFAULT_ORDER).toEqual(expect.arrayContaining(['time-breakdown', 'people-leave']));
		expect(DASHBOARD_WIDGETS.every((w) => w.label && w.description)).toBe(true);
	});
});

describe('detailed dashboard', () => {
	const setup = (extra = []) => {
		mockFetch([...extra, ...dashboardRoutes(), [/^GET \/teams/, okBody([{ ROWID: '7', name: 'Delivery' }])], [/^GET \/projects/, okBody([])]]);
		return renderWithProviders(<DashboardPage />, { user: manager });
	};

	test('hero states the period, summary and freshness, and links each flag to where it is handled', async () => {
		setup();
		const hero = await screen.findByRole('region', { name: 'Overview summary' });
		expect(within(hero).getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
		expect(await within(hero).findByText(/15h 00m of approved time across 9 entries, 66\.7% billable/)).toBeInTheDocument();
		expect(within(hero).getByText(/Time entries: 12 Oct 2026/)).toBeInTheDocument();
		const flag = await within(hero).findByRole('link', { name: /2 time entries are awaiting approval/ });
		expect(flag).toHaveAttribute('href', '/time-entries');
		expect(within(hero).getByRole('img', { name: /Billable share of approved time: 67%/ })).toBeInTheDocument();
		expect(within(hero).getByRole('img', { name: /Late check-in rate: 25%/ })).toBeInTheDocument();
	});

	test('KPI cards carry sparklines from real trend buckets, explanations and drill links', async () => {
		setup();
		const billable = await screen.findByRole('region', { name: 'Billable hours' });
		expect(await within(billable).findByText('Approved entries marked billable. Pending entries are excluded.')).toBeInTheDocument();
		expect(billable.querySelector('.spark')).not.toBeNull(); // two weekly buckets
		expect(within(billable).getByRole('link', { name: 'View details' })).toHaveAttribute('href', '/time-entries');
		// a single attendance bucket is not a trend: no sparkline is drawn for it
		expect(screen.getByRole('region', { name: 'Late check-in rate' }).querySelector('.spark')).toBeNull();
	});

	test('time breakdown shows what is excluded from the totals', async () => {
		setup();
		const card = await screen.findByRole('region', { name: 'Where approved time goes' });
		expect(await within(card).findByText('Not counted in these totals')).toBeInTheDocument();
		expect(within(card).getByText(/pending approval/).closest('li')).toHaveTextContent('2');
		expect(within(card).getByText(/rejected/).closest('li')).toHaveTextContent('1');
		expect(within(card).getByRole('link', { name: 'Review' })).toHaveAttribute('href', '/time-entries');
		expect(within(card).getByRole('img', { name: /Approved time by billing: Billable 10h 00m, Non-billable 5h 00m/ })).toBeInTheDocument();
	});

	test('people, attendance and leave use the backend counts, with unknown kept apart', async () => {
		setup();
		const card = await screen.findByRole('region', { name: 'People, attendance and leave' });
		expect(await within(card).findByRole('img', { name: /Employees by status: Active 11, On leave 1/ })).toBeInTheDocument();
		expect(within(card).getByRole('img', { name: /Attendance records by late status: On time 6, Late 2, Unknown 1/ })).toBeInTheDocument();
		expect(within(card).getByText(/Unknown late status is left out of the late rate/)).toBeInTheDocument();
		expect(within(card).getByText('Approved days').nextSibling).toHaveTextContent('3');
	});

	test('projects show burn against the estimate and say plainly when there is none', async () => {
		setup();
		const card = await screen.findByRole('region', { name: 'Project health and workload' });
		const list = await within(card).findByRole('list', { name: 'Approved hours by project' });
		expect(within(list).getByText('120% of 10h estimate (over)')).toBeInTheDocument();
		expect(within(list).getByText('No estimate recorded')).toBeInTheDocument();
		expect(within(list).getByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '/projects?q=Alpha');
		expect(within(card).getByText('1 of 2 shown over estimate')).toBeInTheDocument();
	});

	test('product and usage cards break items down by type and tool', async () => {
		setup();
		const product = await screen.findByRole('region', { name: 'Product development' });
		expect(await within(product).findByRole('list', { name: 'Product items by type' })).toBeInTheDocument();
		expect(within(product).getByText('2 open past due')).toBeInTheDocument();
		const usage = await screen.findByRole('region', { name: 'AI and GitHub usage' });
		expect(await within(usage).findByText('avg 50% reported')).toBeInTheDocument();
		expect(within(usage).getByText('no % reported')).toBeInTheDocument();
		expect(within(usage).getByText(/1 records without a reporting period are excluded/)).toBeInTheDocument();
	});

	test('no data: nothing is invented, and there is no gauge arc or sparkline', async () => {
		const noTime = { completeness: 'insufficient_data', billableMinutes: null, nonBillableMinutes: null, totalMinutes: null, billablePercent: null, approvedEntries: 0, excluded: { pending: 0, rejected: 0 } };
		const empty = { ...overviewFixture, time: noTime, attendance: { completeness: 'insufficient_data', lateRatePercent: null, records: 0, unknownCount: 0 }, leave: { completeness: 'insufficient_data', approvedDays: null, approvedHours: null, records: 0 }, headcount: { completeness: 'insufficient_data', total: null, byStatus: {} } };
		setup([[/^GET \/dashboard\/overview/, okBody(empty)], [/^GET \/dashboard\/trends/, okBody({ filters: { granularity: 'week' }, truncated: false, time: [], attendance: [] })]]);
		const hero = await screen.findByRole('region', { name: 'Overview summary' });
		expect(await within(hero).findByText('No approved time in this selection yet.')).toBeInTheDocument();
		expect(hero.querySelector('.ring__arc')).toBeNull();
		expect(await screen.findByText('No approved time to break down')).toBeInTheDocument();
		expect(screen.getByRole('region', { name: 'Billable hours' }).querySelector('.spark')).toBeNull();
	});
});
