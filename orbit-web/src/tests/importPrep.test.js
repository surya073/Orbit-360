import { readCsv } from '../utils/csv';
import { matchHeaders } from '../utils/headerMatch';
import { EXTRA, buildRecords, detailsForRow, emptyColumns, isErrorCell, normalizeDate, normalizeValue, parseLooseDetails } from '../utils/importPrep';

// the employees record type as /imports/templates describes it
const employees = {
	module: 'employees',
	columns: [
		{ field: 'employee_code', type: 'str' },
		{ field: 'full_name', type: 'str', required: true },
		{ field: 'email_normalized', type: 'str' },
		{ field: 'job_role', type: 'str' },
		{ field: 'joining_date', type: 'date' },
		{ field: 'reports_to_employee_id', type: 'id' },
		{ field: 'employment_status', type: 'enum', values: ['active', 'inactive', 'on_leave', 'unknown'] },
		{ field: 'primary_team_id', type: 'id' },
		{ field: 'more_details', type: 'json' },
	],
};
const matchable = [...employees.columns.filter((c) => c.field !== 'more_details'), { field: 'source_record_id', type: 'str' }];

/** What the import screen does with a file before sending it: match, send unmatched non-empty columns to more_details, build records. */
function prepare(csvText) {
	const { headers, cells } = readCsv(csvText);
	const matches = matchHeaders(headers, cells, matchable);
	const mapping = matches.map((m) => (m ? m.field : null));
	const blank = emptyColumns(headers, cells);
	mapping.forEach((m, i) => {
		if (!m && !blank[i]) mapping[i] = EXTRA;
	});
	return { headers, mapping, ...buildRecords(cells, mapping, headers, employees) };
}

describe('dates', () => {
	test.each([
		['05-01-2026', '2026-01-05'],
		['04-08-2025', '2025-08-04'],
		['5 Jan 2026', '2026-01-05'],
		['4 August 2025', '2025-08-04'],
		['Sept 3, 2025', '2025-09-03'],
		['2026/1/5', '2026-01-05'],
		['2026-01-05', '2026-01-05'],
		['01-25-2026', '2026-01-25'], // a part above 12 can only be the day
		['5/1/26', '2026-01-05'],
		['2026-01-05 10:30:00', '2026-01-05'],
		['Feb 2024', '2024-02-01'], // only a month and a year: the first of the month
		['February 2024', '2024-02-01'],
	])('%s is read as %s', (input, iso) => {
		expect(normalizeDate(input)).toBe(iso);
	});
	test.each(['31-02-2026', 'soon', '', '13-13-2026', '1/1/1800'])('%s is not a date', (input) => {
		expect(normalizeDate(input)).toBeNull();
	});
});

describe('values', () => {
	const col = (type, extra = {}) => ({ field: 'x', type, ...extra });
	test('allowed values match whatever the case or spacing', () => {
		expect(normalizeValue(col('enum', { values: ['active', 'on_leave'] }), 'Active')).toBe('active');
		expect(normalizeValue(col('enum', { values: ['active', 'on_leave'] }), 'On Leave')).toBe('on_leave');
		expect(normalizeValue(col('enum', { values: ['active'] }), 'TRUE')).toBe('TRUE'); // not guessed: the server explains it
	});
	test('yes/no, numbers and error cells', () => {
		expect(normalizeValue(col('bool'), 'Yes')).toBe('true');
		expect(normalizeValue(col('bool'), 'N')).toBe('false');
		expect(normalizeValue(col('num'), '1,250.50')).toBe('1250.50');
		expect(normalizeValue(col('int'), '40%')).toBe('40');
		expect(normalizeValue(col('str'), '#REF!')).toBe('');
		expect(normalizeValue(col('str'), '    Asha \u{1F600} ')).toBe('Asha');
		expect(isErrorCell('#N/A')).toBe(true);
		expect(isErrorCell('N/A person')).toBe(false);
	});
});

describe('more_details', () => {
	test('"Key: value; Key: value" text becomes an object, JSON is kept, anything else is a note', () => {
		expect(parseLooseDetails("AI: Chat GPT; GitHub: No; Projects: AusFleet, JSW")).toEqual({ AI: 'Chat GPT', GitHub: 'No', Projects: 'AusFleet, JSW' });
		expect(parseLooseDetails('{"a":1,"b":"x"}')).toEqual({ a: 1, b: 'x' });
		expect(parseLooseDetails('just a remark')).toEqual({ notes: 'just a remark' });
		expect(parseLooseDetails('')).toEqual({});
	});
	test('repeated headers keep every value, blank and error cells are skipped, long values are shortened', () => {
		const { object, cut } = detailsForRow(['x', 'y', '#REF!', '', 'z'.repeat(900)], [
			{ header: 'Status', index: 0 },
			{ header: 'Status', index: 1 },
			{ header: 'Err', index: 2 },
			{ header: 'Empty', index: 3 },
			{ header: 'Long', index: 4 },
		]);
		expect(Object.keys(object)).toEqual(['Status', 'Status (2)', 'Long']);
		expect(object.Long.length).toBeLessThanOrEqual(400);
		expect(cut).toBe(true);
	});
	test('the serialized size is capped by dropping the last keys, never silently exceeding it', () => {
		const cols = Array.from({ length: 30 }, (_, i) => ({ header: `Column ${i}`, index: i }));
		const row = Array.from({ length: 30 }, () => 'v'.repeat(300));
		const { json, cut } = detailsForRow(row, cols);
		expect(json.length).toBeLessThanOrEqual(4000);
		expect(cut).toBe(true);
	});
});

describe('the template-style upload (dates day-first, a more_details text column, a repeated status column)', () => {
	const csv = [
		'employee_code,full_name,email_normalized,job_role,joining_date,employment_status,employment_status,primary_team_id,more_details,source_record_id',
		'1,Asha Rao,asha@example.com,QA Engineer,05-01-2026,Active,TRUE,,"AI: Chat GPT; GitHub: No; Projects: Alpha, Beta; Source S.NO: 1",1',
		'2,Bala Kumar,bala@example.com,Designer,04-08-2025,Active,TRUE,,"AI: Claude; GitHub: Yes",2',
	].join('\n');
	test('every row is readable: dates converted, extra columns and the details text kept together', () => {
		const { records, mapping, headers } = prepare(csv);
		expect(headers.length).toBe(10);
		expect(mapping.filter((m) => m === 'employment_status')).toHaveLength(1); // the second one cannot take the same field
		expect(records[0]).toMatchObject({ employee_code: '1', full_name: 'Asha Rao', email_normalized: 'asha@example.com', job_role: 'QA Engineer', joining_date: '2026-01-05', employment_status: 'active', source_record_id: '1' });
		expect(records[1].joining_date).toBe('2025-08-04');
		const details = JSON.parse(records[0].more_details);
		expect(details).toMatchObject({ AI: 'Chat GPT', GitHub: 'No', Projects: 'Alpha, Beta', 'Source S.NO': '1' });
		expect(details['employment_status']).toBe('TRUE'); // the second status column is kept, not lost
		expect(records[0].primary_team_id).toBeUndefined(); // blank cells are omitted, never turned into 0 or ''
	});
});

describe('an arbitrary spreadsheet export', () => {
	const csv = [
		'Full Name,S.NO,Email ID,Role,Joining Date,Number of Projects ,Reports To,,Projects Allocated,Status,AI,GIT HUB,Percentage % Using',
		'Asha Rao,1,asha@example.com,QA Engineer,5 Jan 2026,#REF!,Raja Lakshmi,,,TRUE,"Chat GPT, Claude",No,40-50%',
		'Bala Kumar,2,bala@example.com,Designer,4 August 2025,#REF!,Shatish,2 hrs,,TRUE,Claude,Yes,60 %',
	].join('\n');
	test('known columns are matched, a date like "5 Jan 2026" works, and everything else is kept as more details', () => {
		const { records, mapping, headers } = prepare(csv);
		const at = (h) => mapping[headers.indexOf(h)];
		expect(at('Full Name')).toBe('full_name');
		expect(at('Email ID')).toBe('email_normalized');
		expect(at('Role')).toBe('job_role');
		expect(at('Joining Date')).toBe('joining_date');
		expect(at('Reports To')).toBe(EXTRA); // names are not row ids
		expect(at('Status')).toBe(EXTRA); // TRUE is not an employment status
		expect(records[0]).toMatchObject({ full_name: 'Asha Rao', email_normalized: 'asha@example.com', job_role: 'QA Engineer', joining_date: '2026-01-05' });
		expect(records[1].joining_date).toBe('2025-08-04');
		const d0 = JSON.parse(records[0].more_details);
		expect(d0).toMatchObject({ 'S.NO': '1', 'Reports To': 'Raja Lakshmi', Status: 'TRUE', AI: 'Chat GPT, Claude', 'GIT HUB': 'No', 'Percentage % Using': '40-50%' });
		expect(d0['Number of Projects']).toBeUndefined(); // #REF! cells are dropped
		const d1 = JSON.parse(records[1].more_details);
		expect(d1['Column 8']).toBe('2 hrs'); // the unnamed column keeps its value under a readable name
	});
});

describe('the spreadsheet editor reads cells the same way', () => {
	// eslint-disable-next-line global-require
	const { normalizeCell } = require('../features/spreadsheet/gridModel');
	test('dates typed or pasted in the usual styles become YYYY-MM-DD, and error cells are empty', () => {
		const date = { field: 'joining_date', type: 'date' };
		expect(normalizeCell(date, '05-01-2026')).toEqual({ value: '2026-01-05' });
		expect(normalizeCell(date, '4 August 2025')).toEqual({ value: '2025-08-04' });
		expect(normalizeCell(date, '2026-01-05')).toEqual({ value: '2026-01-05' });
		expect(normalizeCell(date, 'yesterday').error).toMatch(/Use YYYY-MM-DD/);
		expect(normalizeCell(date, '#REF!')).toEqual({ value: '' });
		expect(normalizeCell({ field: 'n', type: 'num' }, '1,250.5')).toEqual({ value: '1250.5' });
		expect(normalizeCell({ field: 'n', type: 'int' }, '40%')).toEqual({ value: '40' });
		expect(normalizeCell({ field: 'at', type: 'datetime' }, '5 Jan 2026')).toEqual({ value: '2026-01-05 00:00:00' });
	});
});

describe('rows with a missing or extra comma', () => {
	test('are reported with their row number and how many values they have', () => {
		const { headers, ragged, expected } = readCsv('a,b,c\n1,2,3\n4,5\n6,7,8,9\n');
		expect(headers).toEqual(['a', 'b', 'c']);
		expect(expected).toBe(3);
		expect(ragged).toEqual([
			{ rowNumber: 2, got: 2 },
			{ rowNumber: 3, got: 4 },
		]);
	});
	test('a clean file reports none', () => {
		expect(readCsv('a,b\n1,2\n3,4\n').ragged).toEqual([]);
	});
});
