import { customColumns, keyFromLabel, normalizeCell, parseExtra, splitCustom, withCustomValues } from '../features/spreadsheet/gridModel';

const defs = [
	{ field_key: 'client_tier', label: 'Client tier', field_type: 'choice', choices: 'Gold, Silver', sort_order: 1 },
	{ field_key: 'score', label: 'Score', field_type: 'number' },
	{ field_key: 'notes', label: 'Notes', field_type: 'text' },
];

describe('custom columns', () => {
	test('definitions become grid columns after the built-in ones', () => {
		const cols = customColumns(defs);
		expect(cols.map((c) => c.field)).toEqual(['x:client_tier', 'x:score', 'x:notes']);
		expect(cols[0]).toMatchObject({ type: 'enum', values: ['Gold', 'Silver'], custom: true, label: 'Client tier' });
		expect(cols[1].type).toBe('num');
		expect(cols[2].maxLength).toBe(500);
	});

	test('values are read from more_details and exposed as x: fields; broken JSON is ignored', () => {
		const rows = withCustomValues([{ ROWID: '1', more_details: '{"client_tier":"Gold","score":7,"other":1}' }, { ROWID: '2', more_details: '{nope' }, { ROWID: '3' }], defs);
		expect(rows[0]['x:client_tier']).toBe('Gold');
		expect(rows[0]['x:score']).toBe(7);
		expect(rows[0]['x:other']).toBeUndefined();
		expect(rows[1]['x:score']).toBeUndefined();
		expect(rows[2]).toEqual({ ROWID: '3' });
		expect(parseExtra({ more_details: '[1]' })).toEqual({});
		expect(withCustomValues([{ ROWID: '1' }], [])).toEqual([{ ROWID: '1' }]);
	});

	test('edits split into built-in fields and more_details values', () => {
		expect(splitCustom({ job_role: 'Lead', 'x:score': '7', 'x:notes': '' })).toEqual({ plain: { job_role: 'Lead' }, extra: { score: '7', notes: '' } });
	});

	test('choice cells match case-insensitively and reject other values; numbers are checked', () => {
		const [tier, score] = customColumns(defs);
		expect(normalizeCell(tier, 'gold')).toEqual({ value: 'Gold' });
		expect(normalizeCell(tier, 'Bronze').error).toMatch(/Must be one of/);
		expect(normalizeCell(score, 'abc').error).toBeTruthy();
		expect(normalizeCell(score, '')).toEqual({ value: '' });
	});

	test('keys are made from the label and stay unique', () => {
		expect(keyFromLabel('Client tier')).toBe('client_tier');
		expect(keyFromLabel('Client tier', ['client_tier'])).toBe('client_tier_2');
		expect(keyFromLabel('  99 Problems! ')).toBe('problems');
		expect(keyFromLabel('???')).toBe('field');
		expect(/^[a-z][a-z0-9_]{1,39}$/.test(keyFromLabel('x'.repeat(80)))).toBe(true);
	});
});
