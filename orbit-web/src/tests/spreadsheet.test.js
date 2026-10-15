import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __clearLookupCache } from '../hooks/useLookup';
import { __resetTemplateCache } from '../hooks/useTemplates';
import { buildColumns, columnLetter, jumpTarget, normalizeCell, parseTsv, rangeLabel, rowsToCsv, sortRows, toTsv } from '../features/spreadsheet/gridModel';
import SpreadsheetPage from '../features/spreadsheet/SpreadsheetPage';
import { admin, errBody, manager, mockFetch, okBody, renderWithProviders } from './helpers';

const template = {
	module: 'employees',
	importable: true,
	adminOnly: false,
	immutable: ['primary_team_id'],
	importColumns: ['source_record_id'],
	columns: [
		{ field: 'full_name', type: 'str', required: true, maxLength: 200 },
		{ field: 'job_role', type: 'str', required: false, maxLength: 120 },
		{ field: 'joining_date', type: 'date', required: false },
		{ field: 'employment_status', type: 'enum', required: false, values: ['active', 'inactive', 'on_leave'] },
		{ field: 'primary_team_id', type: 'id', required: false },
		{ field: 'more_details', type: 'json', required: false },
	],
};
const teamsTemplate = { module: 'teams', importable: true, adminOnly: true, immutable: [], importColumns: [], columns: [{ field: 'name', type: 'str', required: true, maxLength: 150 }] };

const rows = () => [
	{ ROWID: '1', full_name: 'Asha Rao', job_role: 'Engineer', joining_date: '2024-01-10', employment_status: 'active', primary_team_id: '7' },
	{ ROWID: '2', full_name: 'Bala Iyer', job_role: 'Designer', joining_date: '2024-02-11', employment_status: 'on_leave', primary_team_id: '7' },
	{ ROWID: '3', full_name: 'Chitra Nair', job_role: null, joining_date: null, employment_status: 'active', primary_team_id: '8' },
];
const meta = { page: 1, pageSize: 50, total: 3, totalPages: 1 };

beforeEach(() => {
	window.localStorage.clear();
	__resetTemplateCache();
	__clearLookupCache();
});
afterEach(() => {
	delete global.fetch;
});

describe('grid model', () => {
	test('column letters count like a spreadsheet', () => {
		expect([0, 1, 25, 26, 27, 51, 52].map(columnLetter)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA']);
	});

	test('columns come from the backend field contract; json fields are not editable cells', () => {
		const cols = buildColumns(template, rows());
		expect(cols.map((c) => c.field)).toEqual(['full_name', 'job_role', 'joining_date', 'employment_status', 'primary_team_id']);
		expect(cols.find((c) => c.field === 'primary_team_id')).toMatchObject({ fk: true, immutable: true });
		expect(cols.find((c) => c.field === 'full_name').required).toBe(true);
		// fields the list endpoint does not return are not shown (no fake blanks)
		expect(buildColumns(template, [{ ROWID: '1', full_name: 'A' }]).map((c) => c.field)).toEqual(['full_name']);
	});

	test('cell normalisation validates by type and accepts friendly input', () => {
		const [name, , date, status, team] = buildColumns(template, null);
		expect(normalizeCell(name, '  Ada  ')).toEqual({ value: 'Ada' });
		expect(normalizeCell(name, 'x'.repeat(201)).error).toMatch(/at most 200/i);
		expect(normalizeCell(date, '2024-02-30').error).toMatch(/YYYY-MM-DD/);
		expect(normalizeCell(date, '2024-02-29')).toEqual({ value: '2024-02-29' });
		expect(normalizeCell(status, 'On leave')).toEqual({ value: 'on_leave' });
		expect(normalizeCell(status, 'sleeping').error).toMatch(/Must be one of/);
		expect(normalizeCell(team, '12')).toEqual({ value: '12' });
		expect(normalizeCell(team, 'Delivery').error).toMatch(/numeric/);
		expect(normalizeCell({ type: 'bool' }, 'yes')).toEqual({ value: 'true' });
		expect(normalizeCell({ type: 'int' }, '4.5').error).toMatch(/whole/);
		expect(normalizeCell({ type: 'int' }, '')).toEqual({ value: '' });
	});

	test('tab-separated clipboard text round-trips, including quotes and newlines', () => {
		expect(parseTsv('a\tb\r\nc\td\n')).toEqual([['a', 'b'], ['c', 'd']]);
		expect(parseTsv('"x\ty"\t"he said ""hi"""')).toEqual([['x\ty', 'he said "hi"']]);
		const m = [['a\tb', 'c'], ['d', 'line1\nline2']];
		expect(parseTsv(toTsv(m))).toEqual(m);
	});

	test('sorting is stable, blanks go last, and returns the original row objects', () => {
		const cols = buildColumns(template, null);
		const list = rows();
		const get = (r, f) => r[f];
		expect(sortRows(list, cols[1], 'asc', get).map((r) => r.ROWID)).toEqual(['2', '1', '3']);
		expect(sortRows(list, cols[1], 'desc', get).map((r) => r.ROWID)).toEqual(['1', '2', '3']);
		expect(sortRows(list, cols[1], null, get)).toBe(list);
	});

	test('Ctrl+Arrow jumps to the edge of a data run, then to the next data, then to the sheet edge', () => {
		const data = ['a', 'b', '', '', 'c', 'd', '', 'e'];
		const down = (r) => jumpTarget((rr) => data[rr] !== '', r, 0, 1, 0, data.length, 1)[0];
		expect(down(0)).toBe(1); // inside a run: to its last cell
		expect(down(1)).toBe(4); // at the end of a run: to the next data
		expect(down(4)).toBe(5);
		expect(down(5)).toBe(7); // end of a run: next data
		expect(down(7)).toBe(7); // already at the edge
		expect(jumpTarget(() => false, 0, 0, 1, 0, 5, 1)).toEqual([4, 0]); // nothing below: sheet edge
		expect(jumpTarget((r) => r === 0, 3, 0, -1, 0, 5, 1)).toEqual([0, 0]);
	});

	test('range labels read like a name box', () => {
		expect(rangeLabel({ r0: 0, c0: 0, r1: 0, c1: 0 })).toBe('A1');
		expect(rangeLabel({ r0: 4, c0: 2, r1: 1, c1: 0 })).toBe('A2:C5');
	});

	test('CSV export uses the real field names as headers', () => {
		const cols = buildColumns(template, null).slice(0, 2);
		expect(rowsToCsv(cols, rows().slice(0, 1), (r, f) => r[f])).toBe('full_name,job_role\r\nAsha Rao,Engineer');
	});
});

describe('Spreadsheet editor page', () => {
	function setup({ user = manager, patch, post, list = rows } = {}) {
		mockFetch([
			[/^GET \/imports\/templates/, okBody([template, teamsTemplate])],
			[/^GET \/employees\?.*ids=/, (line) => okBody(list().filter((r) => line.includes(`ids=${r.ROWID}`) || /ids=[\d%C,]+/.test(line)), meta)],
			[/^GET \/employees/, () => okBody(list(), meta)],
			[/^GET \/teams/, okBody([{ ROWID: '7', name: 'Delivery' }, { ROWID: '8', name: 'Platform' }], meta)],
			[/^PATCH \/employees\/(\d+)/, patch || (() => okBody({}))],
			[/^POST \/employees$/, post || (() => ({ status: 201, body: okBody({ ROWID: '99' }) }))],
		]);
		return renderWithProviders(<SpreadsheetPage />, { user, route: '/spreadsheet?module=employees' });
	}
	const gridcell = (rowIdx, colIdx) => within(screen.getAllByRole('row')[rowIdx + 1]).getAllByRole('gridcell')[colIdx];
	const writes = (verb) => global.fetch.calls.filter((c) => c.line.startsWith(verb));

	async function editCell(r, c, text) {
		await userEvent.click(gridcell(r, c));
		await userEvent.keyboard('{Enter}');
		const input = screen.getByRole('textbox', { name: /./ });
		await userEvent.clear(input);
		await userEvent.type(input, `${text}{Enter}`);
	}

	test('loads real records, shows letters and field names, and offers the three entry options', async () => {
		setup();
		expect(await screen.findByRole('grid', { name: 'Employees spreadsheet' })).toBeInTheDocument();
		expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
		expect(screen.getAllByRole('columnheader').map((h) => h.textContent).join('|')).toMatch(/AFull name/);
		const modes = screen.getByRole('navigation', { name: 'Data entry options' });
		expect(within(modes).getAllByRole('link').map((l) => l.textContent)).toEqual([expect.stringContaining('Add form'), expect.stringContaining('Sheet import'), expect.stringContaining('Spreadsheet editor')]);
		expect(within(modes).getByRole('link', { name: /Add form/ })).toHaveAttribute('href', '/employees?new=1');
		await userEvent.click(screen.getByRole('button', { name: 'About the spreadsheet editor' }));
		expect(screen.getByText(/new columns cannot be added/)).toBeInTheDocument();
	});

	test('edits a cell, marks it unsaved, and saves only the changed field to the existing update endpoint', async () => {
		setup();
		await screen.findByText('Asha Rao');
		await editCell(0, 1, 'Principal');
		expect(gridcell(0, 1)).toHaveClass('is-dirty');
		expect(screen.getByText('1 unsaved change')).toBeInTheDocument();
		expect(writes('PATCH')).toHaveLength(0); // nothing is sent while typing
		await userEvent.click(screen.getByRole('button', { name: /Save changes/ }));
		await waitFor(() => expect(writes('PATCH')).toHaveLength(1));
		const call = writes('PATCH')[0];
		expect(call.line).toBe('PATCH /employees/1');
		expect(JSON.parse(call.init.body)).toEqual({ job_role: 'Principal' });
		await waitFor(() => expect(screen.getByText(/^Saved \d/)).toBeInTheDocument());
	});

	test('a failed save keeps the edit, flags the row, and a retry succeeds', async () => {
		let fail = true;
		setup({ patch: () => (fail ? { status: 500, body: errBody(500, 'INTERNAL', 'Server exploded') } : okBody({})) });
		await screen.findByText('Asha Rao');
		await editCell(0, 1, 'Lead');
		await userEvent.click(screen.getByRole('button', { name: /Save changes/ }));
		await waitFor(() => expect(screen.getByRole('img', { name: 'Server exploded' })).toBeInTheDocument());
		expect(gridcell(0, 1)).toHaveClass('is-dirty');
		expect(gridcell(0, 1)).toHaveTextContent('Lead');
		fail = false;
		await userEvent.click(screen.getByRole('button', { name: /Save changes/ }));
		await waitFor(() => expect(writes('PATCH')).toHaveLength(2));
		await waitFor(() => expect(screen.queryByRole('img', { name: 'Server exploded' })).not.toBeInTheDocument());
	});

	test('invalid values are rejected before saving and the cell is left unchanged', async () => {
		setup();
		await screen.findByText('Asha Rao');
		await editCell(0, 2, 'yesterday');
		expect(gridcell(0, 2)).toHaveTextContent('2024-01-10');
		expect(gridcell(0, 2)).not.toHaveClass('is-dirty');
		expect(screen.getByText(/Use YYYY-MM-DD/)).toBeInTheDocument();
	});

	test('saved values cannot be cleared and identifying fields cannot be edited on existing rows', async () => {
		setup();
		await screen.findByText('Asha Rao');
		await userEvent.click(gridcell(0, 1));
		await userEvent.keyboard('{Delete}');
		expect(gridcell(0, 1)).not.toHaveClass('is-dirty');
		expect(await screen.findByText(/a saved value cannot be cleared/)).toBeInTheDocument();
		await userEvent.click(gridcell(0, 4));
		await userEvent.keyboard('{Enter}');
		expect(gridcell(0, 4)).toHaveAttribute('aria-readonly', 'true');
		expect(screen.getByText(/cannot be changed after the record is created/)).toBeInTheDocument();
	});

	test('new rows: required fields block the create, then the row is created exactly once', async () => {
		setup();
		await screen.findByText('Asha Rao');
		await userEvent.click(screen.getByRole('button', { name: 'Add row' }));
		const newRowIdx = 3;
		await editCell(newRowIdx, 1, 'Tester');
		await userEvent.click(screen.getByRole('button', { name: /Save changes/ }));
		await waitFor(() => expect(gridcell(newRowIdx, 0)).toHaveClass('has-error'));
		expect(writes('POST')).toHaveLength(0);
		await editCell(newRowIdx, 0, 'Nina New');
		await userEvent.click(screen.getByRole('button', { name: /Save changes/ }));
		await waitFor(() => expect(writes('POST')).toHaveLength(1));
		expect(JSON.parse(writes('POST')[0].init.body)).toEqual({ full_name: 'Nina New', job_role: 'Tester' });
		await waitFor(() => expect(screen.getByText(/^Saved \d/)).toBeInTheDocument());
		expect(writes('POST')).toHaveLength(1);
	});

	test('pasting tab-separated rows fills cells and adds rows below the last one; HTML is ignored', async () => {
		setup();
		await screen.findByText('Asha Rao');
		await userEvent.click(gridcell(2, 0));
		const grid = screen.getByRole('grid');
		fireEvent.paste(grid, { clipboardData: { getData: (t) => (t === 'text/plain' ? 'Pat One\tDev\nPat Two\tQA' : '<b>nope</b>') } });
		await waitFor(() => expect(screen.getByText('Pat Two')).toBeInTheDocument());
		expect(gridcell(2, 0)).toHaveTextContent('Pat One');
		expect(gridcell(2, 0)).toHaveClass('is-dirty'); // existing row edited
		expect(screen.getAllByRole('row').length).toBe(1 + 4); // header + 3 loaded + 1 new
		expect(screen.getByText(/Pasted 4 cells/)).toBeInTheDocument();
	});

	test('undo and redo revert local edits only', async () => {
		setup();
		await screen.findByText('Asha Rao');
		await editCell(0, 1, 'Temp');
		await userEvent.click(screen.getByRole('button', { name: /Undo/ }));
		expect(gridcell(0, 1)).toHaveTextContent('Engineer');
		expect(screen.getByText('Saved')).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: /Redo/ }));
		expect(gridcell(0, 1)).toHaveTextContent('Temp');
		expect(writes('PATCH')).toHaveLength(0);
	});

	test('sorting does not change which record an edit belongs to', async () => {
		setup();
		await screen.findByText('Asha Rao');
		await userEvent.click(screen.getByRole('button', { name: /Sort by Full name/ }));
		await userEvent.click(screen.getByRole('button', { name: /Sort by Full name/ })); // descending: Chitra first
		expect(gridcell(0, 0)).toHaveTextContent('Chitra Nair');
		await editCell(0, 1, 'Sorted edit');
		await userEvent.click(screen.getByRole('button', { name: /Save changes/ }));
		await waitFor(() => expect(writes('PATCH')).toHaveLength(1));
		expect(writes('PATCH')[0].line).toBe('PATCH /employees/3');
	});

	test('a load failure shows an error with retry and no fake rows', async () => {
		mockFetch([
			[/^GET \/imports\/templates/, okBody([template])],
			[/^GET \/employees/, { status: 500, body: errBody(500, 'INTERNAL', 'Boom') }],
		]);
		renderWithProviders(<SpreadsheetPage />, { user: manager, route: '/spreadsheet?module=employees' });
		expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded|Boom/i);
		expect(screen.queryByRole('grid')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /retry|try again/i })).toBeInTheDocument();
	});

	test('record types a role cannot write are read-only (no save, no editing)', async () => {
		mockFetch([
			[/^GET \/imports\/templates/, okBody([teamsTemplate])],
			[/^GET \/teams\?.*page=/, okBody([{ ROWID: '7', name: 'Delivery' }], meta)],
			[/^GET \/teams/, okBody([{ ROWID: '7', name: 'Delivery' }], meta)],
		]);
		renderWithProviders(<SpreadsheetPage />, { user: manager, route: '/spreadsheet?module=teams' });
		expect(await screen.findByText('Delivery')).toBeInTheDocument();
		expect(screen.getByText('Read-only')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Save changes/ })).not.toBeInTheDocument();
		expect(screen.getByRole('grid')).toHaveAttribute('aria-readonly', 'true');
		await userEvent.click(screen.getByRole('button', { name: 'About the spreadsheet editor' }));
		expect(screen.getByText(/Only administrators can change this record type/)).toBeInTheDocument();
	});

	test('administrators get the admin-only record types as writable', async () => {
		mockFetch([
			[/^GET \/imports\/templates/, okBody([teamsTemplate])],
			[/^GET \/teams/, okBody([{ ROWID: '7', name: 'Delivery' }], meta)],
		]);
		renderWithProviders(<SpreadsheetPage />, { user: admin, route: '/spreadsheet?module=teams' });
		expect(await screen.findByText('Delivery')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Save changes/ })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Add row' })).toBeEnabled();
	});

	describe('workspace interactions', () => {
		const grid = () => screen.getByRole('grid');
		const selectedCells = () => screen.getAllByRole('gridcell').filter((c) => c.getAttribute('aria-selected') === 'true');

		test('typing on a selected cell starts an edit that replaces its text (and arrow keys never edit)', async () => {
			setup();
			await screen.findByText('Asha Rao');
			await userEvent.click(gridcell(0, 1));
			await userEvent.keyboard('{ArrowRight}{ArrowLeft}{ArrowDown}{ArrowUp}');
			expect(gridcell(0, 1)).toHaveTextContent('Engineer'); // navigation did not touch the value
			expect(screen.queryByRole('textbox', { name: 'Job role' })).not.toBeInTheDocument();
			await userEvent.keyboard('Z');
			expect(await screen.findByRole('textbox', { name: 'Job role' })).toHaveValue('Z');
		});

		test('Shift+Arrow extends the range and the status bar names it', async () => {
			setup();
			await screen.findByText('Asha Rao');
			await userEvent.click(gridcell(0, 0));
			await userEvent.keyboard('{Shift>}{ArrowDown}{ArrowRight}{/Shift}');
			expect(selectedCells()).toHaveLength(4);
			expect(screen.getByText('A1:B2')).toBeInTheDocument();
			expect(screen.getByText(/4 cells/)).toBeInTheDocument();
		});

		test('Ctrl+Shift+Arrow extends to the edge of the data and Ctrl+End / Ctrl+Home jump to the corners', async () => {
			setup();
			await screen.findByText('Asha Rao');
			await userEvent.click(gridcell(0, 1)); // Engineer, Designer, then a blank
			await userEvent.keyboard('{Control>}{Shift>}{ArrowDown}{/Shift}{/Control}');
			expect(screen.getByText('B1:B2')).toBeInTheDocument();
			await userEvent.keyboard('{Control>}{End}{/Control}');
			expect(screen.getByText('E3')).toBeInTheDocument();
			await userEvent.keyboard('{Control>}{Home}{/Control}');
			expect(screen.getByText('A1')).toBeInTheDocument();
		});

		test('Shift+Enter moves up, Tab and Shift+Tab move across', async () => {
			setup();
			await screen.findByText('Asha Rao');
			await userEvent.click(gridcell(1, 1));
			await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
			expect(screen.getByText('B1')).toBeInTheDocument();
			await userEvent.keyboard('{Tab}{Tab}');
			expect(screen.getByText('D1')).toBeInTheDocument();
			await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
			expect(screen.getByText('C1')).toBeInTheDocument();
		});

		test('Ctrl+C and Ctrl+X put the selection on the clipboard as tab-separated text; nothing is saved', async () => {
			setup();
			await screen.findByText('Asha Rao');
			await userEvent.click(gridcell(0, 0));
			await userEvent.keyboard('{Shift>}{ArrowDown}{ArrowRight}{/Shift}');
			const setData = jest.fn();
			fireEvent.copy(grid(), { clipboardData: { setData } });
			expect(setData).toHaveBeenCalledWith('text/plain', 'Asha Rao\tEngineer\nBala Iyer\tDesigner');
			const cutData = jest.fn();
			fireEvent.cut(grid(), { clipboardData: { setData: cutData } });
			expect(cutData).toHaveBeenCalledWith('text/plain', 'Asha Rao\tEngineer\nBala Iyer\tDesigner');
			expect(writes('PATCH')).toHaveLength(0);
		});

		test('Ctrl+F focuses the sheet search instead of the browser find bar; Escape clears it', async () => {
			setup();
			await screen.findByText('Asha Rao');
			await userEvent.click(gridcell(0, 0));
			await userEvent.keyboard('{Control>}f{/Control}');
			const search = screen.getByRole('searchbox', { name: /Search employees/ });
			expect(search).toHaveFocus();
			await userEvent.type(search, 'abc');
			await userEvent.keyboard('{Escape}');
			expect(search).toHaveValue('');
		});

		test('search on a server-searchable sheet waits for a pause, then asks the server once', async () => {
			setup();
			await screen.findByText('Asha Rao');
			const before = global.fetch.calls.length;
			await userEvent.type(screen.getByRole('searchbox', { name: /Search employees/ }), 'bala');
			await waitFor(() => expect(global.fetch.calls.filter((c) => /q=bala/.test(c.line))).toHaveLength(1));
			expect(global.fetch.calls.slice(before).filter((c) => /q=(b|ba|bal)(&|$)/.test(c.line))).toHaveLength(0); // no request per keystroke
		});

		test('search in "Loaded rows" mode filters every visible column without any request', async () => {
			setup();
			await screen.findByText('Asha Rao');
			await userEvent.selectOptions(screen.getByLabelText('Where to search'), 'loaded');
			const before = global.fetch.calls.length;
			await userEvent.type(screen.getByRole('searchbox', { name: 'Search loaded rows' }), 'designer');
			await waitFor(() => expect(screen.getByText(/1 row shown of 3/)).toBeInTheDocument());
			expect(screen.queryByText('Asha Rao')).not.toBeInTheDocument();
			expect(screen.getByText('Bala Iyer')).toBeInTheDocument();
			expect(global.fetch.calls.length).toBe(before);
			await userEvent.clear(screen.getByRole('searchbox'));
			expect(screen.getByText('Asha Rao')).toBeInTheDocument();
		});

		test('Ctrl+S saves pending edits; the save status pill follows the state', async () => {
			setup();
			await screen.findByText('Asha Rao');
			await editCell(0, 1, 'Architect');
			expect(screen.getByText('1 unsaved change')).toBeInTheDocument();
			await userEvent.click(gridcell(0, 0));
			await userEvent.keyboard('{Control>}s{/Control}');
			await waitFor(() => expect(writes('PATCH')).toHaveLength(1));
			await waitFor(() => expect(screen.getByText(/^Saved \d/)).toBeInTheDocument());
		});

		test('right-click offers cell actions and the shortcuts reference opens', async () => {
			setup();
			await screen.findByText('Asha Rao');
			fireEvent.contextMenu(gridcell(0, 1));
			const menu = await screen.findByRole('menu', { name: 'Cell actions' });
			expect(within(menu).getAllByRole('menuitem').map((m) => m.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Cut'), expect.stringContaining('Copy'), expect.stringContaining('Paste'), expect.stringContaining('Clear contents')]));
			await userEvent.keyboard('{Escape}');
			await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
			await userEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
			expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
		});
	});
});
