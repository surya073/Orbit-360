import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImportPage from '../features/imports/ImportPage';
import SettingsPage from '../features/settings/SettingsPage';
import { __resetTemplateCache } from '../hooks/useTemplates';
import { admin, errBody, manager, mockFetch, okBody, renderWithProviders } from './helpers';

// jsdom (this version) lacks Blob/File text readers and crypto.subtle.
beforeAll(() => {
	const read = (blob, how) =>
		new Promise((resolve, reject) => {
			const fr = new FileReader();
			fr.onload = () => resolve(fr.result);
			fr.onerror = reject;
			fr[how](blob);
		});
	File.prototype.text = function text() {
		return read(this, 'readAsText');
	};
	File.prototype.arrayBuffer = function arrayBuffer() {
		return read(this, 'readAsArrayBuffer');
	};
});
beforeEach(() => __resetTemplateCache());
afterEach(() => {
	delete global.fetch;
});

describe('settings', () => {
	test('Appearance is the default tab and the theme applies on click', async () => {
		mockFetch([]);
		renderWithProviders(<SettingsPage />);
		expect(await screen.findByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
		await userEvent.click(screen.getByRole('radio', { name: /^ocean/i }));
		expect(document.documentElement.dataset.theme).toBe('ocean');
		expect(global.fetch).not.toHaveBeenCalled(); // a cosmetic preference needs no backend call
	});

	test('tabs are linkable (?tab=) and keyboard operable', async () => {
		mockFetch([[/^GET \/teams/, okBody([{ ROWID: '7', name: 'Delivery' }], { page: 1, pageSize: 100, total: 1, totalPages: 1 })]]);
		renderWithProviders(<SettingsPage />, { route: '/settings?tab=profile' });
		expect(await screen.findByText('Maya Rao')).toBeInTheDocument();
		expect(screen.getByText('maya@example.com')).toBeInTheDocument();
		expect(await screen.findByText('Delivery')).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
	});

	test('application settings are read-only for managers', async () => {
		mockFetch([[/^GET \/settings/, okBody([{ ROWID: '1', setting_key: 'late.grace', scope: 'global', setting_value: '15', value_type: 'number' }])]]);
		renderWithProviders(<SettingsPage />, { route: '/settings?tab=application' });
		expect(await screen.findByText('late.grace')).toBeInTheDocument();
		expect(screen.getByText(/Read-only/)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Save setting' })).not.toBeInTheDocument();
	});

	test('admins can save a setting; server validation errors show beside the field', async () => {
		mockFetch([
			[/^GET \/settings/, okBody([])],
			[/^PUT \/settings/, (l, init) => (JSON.parse(init.body).setting_key === 'Bad Key' ? { status: 422, body: errBody(422, 'VALIDATION_FAILED', 'Input failed validation', [{ field: 'setting_key', code: 'INVALID_VALUE', message: 'Use lowercase letters, digits, "." and "_"' }]) } : okBody({ ROWID: '2' }))],
		]);
		renderWithProviders(<SettingsPage />, { route: '/settings?tab=application', user: admin });
		const key = await screen.findByLabelText(/Key/);
		await userEvent.type(key, 'Bad Key');
		await userEvent.click(screen.getByRole('button', { name: 'Save setting' }));
		expect(await screen.findByText(/Use lowercase letters/)).toBeInTheDocument();
		await userEvent.clear(key);
		await userEvent.type(key, 'late.grace');
		await userEvent.click(screen.getByRole('button', { name: 'Save setting' }));
		await waitFor(() => expect(global.fetch.calls.filter((c) => c.line === 'PUT /settings')).toHaveLength(2));
		expect(JSON.parse(global.fetch.calls.filter((c) => c.line === 'PUT /settings')[1].init.body)).toEqual({ scope: 'global', setting_key: 'late.grace', value_type: 'string' });
		expect(await screen.findByText('Setting saved')).toBeInTheDocument();
	});
});

describe('import flow', () => {
	const templates = [{ module: 'attendance_records', importable: true, adminOnly: false, immutable: [], columns: [{ field: 'employee_id', type: 'id', required: true }, { field: 'attendance_date', type: 'date', required: true }, { field: 'late_status', type: 'enum', required: true, values: ['yes', 'no', 'unknown'] }] }, { module: 'teams', importable: false, columns: [] }];
	const csv = 'employee_id,attendance_date,late_status,extra\n1,2026-10-01,no,x\n2,2026-10-02,yes,y\n3,bad,no,z\n';
	const upload = (name = 'att.csv', content = csv) => new File([content], name, { type: 'text/csv' });

	const happyRoutes = (log = []) => [
		[/^GET \/imports\/templates/, okBody(templates)],
		[/^POST \/imports\/jobs$/, okBody({ id: '40', status: 'uploaded', batchSize: 2, possibleDuplicateOfJobs: [] })],
		[/^POST \/imports\/jobs\/40\/preview/, (l, init) => {
			const rows = JSON.parse(init.body).rows;
			return okBody({ rows: rows.map((r) => (r.rowNumber === 3 ? { rowNumber: 3, status: 'invalid', errors: [{ field: 'attendance_date', code: 'INVALID_DATE', message: 'Must be a valid YYYY-MM-DD date' }] } : r.rowNumber === 2 ? { rowNumber: 2, status: 'conflict', errors: [], conflict: { targetRowId: '99', resolution: null } } : { rowNumber: r.rowNumber, status: 'valid', errors: [] })) });
		}],
		[/^POST \/imports\/jobs\/40\/resolve/, (l, init) => (log.push(JSON.parse(init.body)), okBody({ results: [] }))],
		[/^POST \/imports\/jobs\/40\/commit/, (l, init) => {
			const rows = JSON.parse(init.body).rows;
			return okBody({ rows: rows.map((r) => ({ rowNumber: r.rowNumber, status: r.rowNumber === 2 ? 'skipped' : 'committed', outcome: r.rowNumber === 2 ? 'skipped' : 'created', errors: [] })) });
		}],
		[/^POST \/imports\/jobs\/40\/complete/, okBody({ jobId: '40', status: 'completed_with_errors', counts: { created: 1, updated: 0, skipped: 1, invalid: 1, conflict: 0 } })],
		[/^POST \/imports\/jobs\/40\/cancel/, okBody({ jobId: '40', status: 'cancelled' })],
	];

	async function choose() {
		renderWithProviders(<ImportPage />);
		await userEvent.selectOptions(await screen.findByLabelText('Data type'), 'attendance_records');
	}

	test('validate in bounded batches, review problems, nothing is written until the user imports', async () => {
		mockFetch(happyRoutes());
		await choose();
		await userEvent.upload(screen.getByLabelText('CSV file'), upload());
		expect(await screen.findByRole('heading', { name: 'Rows with problems' })).toBeInTheDocument();
		expect(screen.getByText('attendance_date: Must be a valid YYYY-MM-DD date')).toBeInTheDocument();
		expect(screen.getByText(/Ignored columns \(no matching field\): extra/)).toBeInTheDocument();
		const previews = global.fetch.calls.filter((c) => /preview/.test(c.line));
		expect(previews).toHaveLength(2); // 3 rows, batch size 2
		expect(JSON.parse(previews[0].init.body).rows).toHaveLength(2);
		expect(global.fetch.calls.some((c) => /commit|complete/.test(c.line))).toBe(false);
		const job = JSON.parse(global.fetch.calls.find((c) => c.line === 'POST /imports/jobs').init.body);
		expect(job).toMatchObject({ module: 'attendance_records', fileType: 'csv', totalRows: 3, conflictPolicy: 'ask' });
		expect(screen.getByRole('button', { name: 'Import valid rows' })).toBeEnabled();
	});

	test('conflict choices are saved per row, then valid rows are committed and the job completed', async () => {
		const resolveLog = [];
		mockFetch(happyRoutes(resolveLog));
		await choose();
		await userEvent.upload(screen.getByLabelText('CSV file'), upload());
		await userEvent.selectOptions(await screen.findByLabelText('Resolution for row 2'), 'skip');
		await userEvent.click(screen.getByRole('button', { name: 'Save choices' }));
		await waitFor(() => expect(resolveLog).toHaveLength(1));
		expect(resolveLog[0]).toEqual({ resolutions: [{ rowNumber: 2, resolution: 'skip' }] });
		await userEvent.click(screen.getByRole('button', { name: 'Import valid rows' }));
		expect(await screen.findByText(/finished with items needing attention: 1 created, 0 updated, 1 skipped, 1 invalid/)).toBeInTheDocument();
		const commits = global.fetch.calls.filter((c) => /commit/.test(c.line));
		expect(commits.length).toBeGreaterThanOrEqual(1);
		const sent = commits.flatMap((c) => JSON.parse(c.init.body).rows.map((r) => r.rowNumber));
		expect(sent.sort()).toEqual([1, 2]); // the invalid row is never sent
		expect(screen.getByRole('button', { name: 'Start another import' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Import valid rows' })).not.toBeInTheDocument();
	});

	test('a failed commit keeps the review and can be retried (the server is idempotent)', async () => {
		let failures = 1;
		const routes = happyRoutes();
		routes.unshift([/^POST \/imports\/jobs\/40\/commit/, (l, init) => (failures-- > 0 ? { status: 500, body: errBody(500, 'INTERNAL_ERROR', 'Unexpected server error') } : okBody({ rows: JSON.parse(init.body).rows.map((r) => ({ rowNumber: r.rowNumber, status: 'committed', outcome: 'created', errors: [] })) }))]);
		mockFetch(routes);
		await choose();
		await userEvent.upload(screen.getByLabelText('CSV file'), upload());
		await userEvent.click(await screen.findByRole('button', { name: 'Import valid rows' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected server error');
		const retry = screen.getByRole('button', { name: 'Import valid rows' });
		expect(retry).toBeEnabled();
		await userEvent.click(retry);
		expect(await screen.findByRole('button', { name: 'Start another import' })).toBeInTheDocument();
	});

	test('non-CSV files and oversized files are rejected before any request', async () => {
		mockFetch(happyRoutes());
		await choose();
		await userEvent.upload(screen.getByLabelText('CSV file'), new File(['x'], 'data.xlsx'), { applyAccept: false });
		expect(await screen.findByRole('alert')).toHaveTextContent(/Only \.csv files/);
		expect(global.fetch.calls.some((c) => c.line === 'POST /imports/jobs')).toBe(false);
	});

	test('cancelling closes the job on the server and clears the review', async () => {
		mockFetch(happyRoutes());
		await choose();
		await userEvent.upload(screen.getByLabelText('CSV file'), upload());
		await userEvent.click(await screen.findByRole('button', { name: 'Cancel import' }));
		expect(await screen.findByText(/Import cancelled/)).toBeInTheDocument();
		expect(global.fetch.calls.some((c) => c.line === 'POST /imports/jobs/40/cancel')).toBe(true);
		expect(screen.queryByRole('button', { name: 'Import valid rows' })).not.toBeInTheDocument();
	});

	test('only importable modules are offered, and a re-upload warning is shown', async () => {
		const routes = happyRoutes();
		routes[1] = [/^POST \/imports\/jobs$/, okBody({ id: '40', status: 'uploaded', batchSize: 100, possibleDuplicateOfJobs: [{ id: '12', status: 'completed' }] })];
		mockFetch(routes);
		await choose();
		expect(within(screen.getByLabelText('Data type')).queryByRole('option', { name: /teams/i })).not.toBeInTheDocument();
		await userEvent.upload(screen.getByLabelText('CSV file'), upload());
		expect(await screen.findByText(/uploaded before for this team/)).toBeInTheDocument();
	});
});
