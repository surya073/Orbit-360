import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColumnConfigDialog from '../features/spreadsheet/ColumnConfigDialog';
import { rowsToCsv } from '../features/spreadsheet/gridModel';
import { applyConfig, configKey, defaultConfig, isDefaultConfig, loadConfig, safeCell, sanitizeConfig, saveConfig } from '../utils/columnConfig';

const columns = [
	{ field: 'full_name', label: 'Full name', type: 'str', required: true },
	{ field: 'job_role', label: 'Job role', type: 'str', required: false },
	{ field: 'joining_date', label: 'Joining date', type: 'date', required: false },
];

describe('column configuration (pure)', () => {
	test('the default config lists every column once, visible, with no renames', () => {
		expect(defaultConfig(columns)).toEqual({ order: ['full_name', 'job_role', 'joining_date'], hidden: [], labels: {} });
	});

	test('a config can only name fields the schema offers: unknown, duplicate and non-string entries are dropped, new columns are appended', () => {
		const cfg = sanitizeConfig({ order: ['joining_date', 'password_hash', 'joining_date', 7, 'full_name'], hidden: ['nope', 'job_role'], labels: { password_hash: 'x', full_name: '  Name\n' } }, columns);
		expect(cfg.order).toEqual(['joining_date', 'full_name', 'job_role']);
		expect(cfg.hidden).toEqual(['job_role']);
		expect(cfg.labels).toEqual({ full_name: 'Name' });
	});

	test('garbage config falls back to the default; labels equal to the default label or blank are dropped; long labels are cut', () => {
		expect(sanitizeConfig('nonsense', columns)).toEqual(defaultConfig(columns));
		expect(sanitizeConfig({ labels: { full_name: 'Full name', job_role: '   ' } }, columns).labels).toEqual({});
		expect(sanitizeConfig({ labels: { job_role: 'x'.repeat(200) } }, columns).labels.job_role).toHaveLength(60);
	});

	test('applyConfig returns the visible columns in the configured order with their header text', () => {
		const out = applyConfig({ order: ['joining_date', 'full_name', 'job_role'], hidden: ['job_role'], labels: { full_name: 'Employee' } }, columns);
		expect(out.map((c) => [c.field, c.exportLabel])).toEqual([
			['joining_date', 'Joining date'],
			['full_name', 'Employee'],
		]);
	});

	test('preferences are stored per user, module and purpose, validated on load, and removed when they equal the default', () => {
		const key = configKey('u1', 'employees', 'export');
		expect(key).not.toBe(configKey('u2', 'employees', 'export'));
		expect(key).not.toBe(configKey('u1', 'projects', 'export'));
		window.localStorage.setItem(key, JSON.stringify({ order: ['job_role', 'ghost'], hidden: ['ghost'] }));
		expect(loadConfig(key, columns).order).toEqual(['job_role', 'full_name', 'joining_date']);
		saveConfig(key, defaultConfig(columns), columns);
		expect(window.localStorage.getItem(key)).toBeNull();
		saveConfig(key, { order: ['job_role', 'full_name', 'joining_date'], hidden: [], labels: {} }, columns);
		expect(isDefaultConfig(loadConfig(key, columns), columns)).toBe(false);
		window.localStorage.setItem(key, '{broken');
		expect(loadConfig(key, columns)).toEqual(defaultConfig(columns));
		window.localStorage.removeItem(key);
	});

	test('cells that start like a formula are written as plain text; real numbers and ordinary text are untouched', () => {
		expect(safeCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
		expect(safeCell('+1 555')).toBe("'+1 555");
		expect(safeCell('@cmd')).toBe("'@cmd");
		expect(safeCell('-cmd')).toBe("'-cmd");
		expect(safeCell('-12.5')).toBe('-12.5');
		expect(safeCell('Asha Rao')).toBe('Asha Rao');
		expect(safeCell(null)).toBe('');
	});

	test('the CSV has the configured columns in order, escapes commas, quotes and newlines, and is just a header row when there are no rows', () => {
		const cols = applyConfig({ order: ['job_role', 'full_name', 'joining_date'], hidden: ['joining_date'], labels: { job_role: 'Role' } }, columns);
		const rows = [{ full_name: 'Rao, "Asha"', job_role: 'Line1\nLine2' }, { full_name: '=cmd()', job_role: '' }];
		const get = (r, f) => r[f];
		expect(rowsToCsv(cols, rows, get, { headers: 'labels' })).toBe('Role,Full name\r\n"Line1\nLine2","Rao, ""Asha"""\r\n,\'=cmd()');
		expect(rowsToCsv(cols, rows, get).split('\r\n')[0]).toBe('job_role,full_name');
		expect(rowsToCsv(cols, [], get, { headers: 'labels' })).toBe('Role,Full name');
	});
});

describe('ColumnConfigDialog', () => {
	const setup = (extra = {}) => {
		const onConfirm = jest.fn();
		const onClose = jest.fn();
		render(<ColumnConfigDialog columns={columns} initial={defaultConfig(columns)} previewRows={[{ full_name: 'Asha Rao', job_role: 'Engineer', joining_date: '2024-01-10' }]} getValue={(r, f) => r[f]} rowCount={1} onConfirm={onConfirm} onClose={onClose} {...extra} />);
		return { onConfirm, onClose };
	};

	test('shows every column with its field name, type and whether it is required', () => {
		setup();
		const list = screen.getByRole('list', { name: 'Columns' });
		expect(within(list).getAllByRole('checkbox')).toHaveLength(3);
		expect(within(list).getByText('full_name')).toBeInTheDocument();
		expect(within(list).getByText('Required')).toBeInTheDocument();
		expect(within(list).getAllByText('Optional')).toHaveLength(2);
	});

	test('deselecting, renaming and reordering with the arrow buttons is reflected in the preview and in what is confirmed', async () => {
		const { onConfirm } = setup();
		await userEvent.click(screen.getByRole('checkbox', { name: 'Include Job role' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Header for Full name' }), 'Employee');
		await userEvent.click(screen.getByRole('button', { name: 'Move Joining date up' }));
		const preview = screen.getByRole('region', { name: 'Preview of the file' });
		expect(within(preview).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Employee', 'Joining date']);
		expect(within(preview).getByText('2024-01-10')).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
		const arg = onConfirm.mock.calls[0][0];
		expect(arg.config.order).toEqual(['full_name', 'joining_date', 'job_role']);
		expect(arg.config.hidden).toEqual(['job_role']);
		expect(arg.config.labels).toEqual({ full_name: 'Employee' });
		expect(arg.headers).toBe('labels');
	});

	test('search narrows the list (reordering is paused), select none disables the download, Reset restores the default', async () => {
		setup();
		await userEvent.type(screen.getByRole('searchbox', { name: 'Search columns' }), 'date');
		expect(within(screen.getByRole('list')).getAllByRole('checkbox')).toHaveLength(1);
		expect(screen.getByText('Clear the search to change the order.')).toBeInTheDocument();
		await userEvent.clear(screen.getByRole('searchbox', { name: 'Search columns' }));
		await userEvent.click(screen.getByRole('button', { name: 'Select none' }));
		expect(screen.getByRole('button', { name: 'Download CSV' })).toBeDisabled();
		expect(screen.getByText('Select at least one column to export.')).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
		expect(screen.getByRole('button', { name: 'Download CSV' })).toBeEnabled();
	});

	test('with no rows the dialog says the file will only contain the header row', () => {
		setup({ previewRows: [], rowCount: 0 });
		expect(screen.getByText(/only the header row/)).toBeInTheDocument();
	});
});

describe('import column mapping helpers', () => {
	// eslint-disable-next-line import/first
	const { autoMapHeaders, duplicateTargets, readCsv, recordsFromMapping } = require('../utils/csv');

	test('headers are matched to fields ignoring case, spaces and dashes; a repeated header is not mapped twice', () => {
		expect(autoMapHeaders(['Full Name', 'job-role', 'JOB_ROLE', 'Nope'], ['full_name', 'job_role'])).toEqual(['full_name', 'job_role', null, null]);
	});

	test('records come from the mapping; blanks are omitted and unmapped columns are left out', () => {
		const { headers, cells } = readCsv('Name,Role,Note\nAsha,,x\n"Rao, B",Lead,y\n');
		expect(headers).toEqual(['Name', 'Role', 'Note']);
		expect(recordsFromMapping(cells, ['full_name', 'job_role', null])).toEqual([{ full_name: 'Asha' }, { full_name: 'Rao, B', job_role: 'Lead' }]);
		expect(duplicateTargets(['a', 'b', 'a', null, null])).toEqual(['a']);
		expect(() => readCsv('only,a,header\n')).toThrow(/at least one data row/);
	});
});
