import { fit, headerSignature, jaroWinkler, matchHeaders, nameScore, rememberMapping, rememberedMapping } from '../utils/headerMatch';

const employees = [
	{ field: 'employee_code', type: 'str', required: false },
	{ field: 'full_name', type: 'str', required: true },
	{ field: 'email_normalized', type: 'str', required: false },
	{ field: 'job_role', type: 'str', required: false },
	{ field: 'joining_date', type: 'date', required: false },
	{ field: 'reports_to_employee_id', type: 'id', required: false },
	{ field: 'employment_status', type: 'enum', required: false, values: ['active', 'on_leave', 'resigned'] },
	{ field: 'source_record_id', type: 'str', required: false },
];
const fields = (m) => m.map((x) => (x ? x.field : null));

describe('header matching', () => {
	test('the renamed-headers sample file maps every real column', () => {
		const headers = ['Employee Code', 'Name', 'Mail', 'Position', 'Joined On', 'Extra Notes'];
		const cells = [['EMP020', 'Pooja Menon', 'pooja@example.com', 'Designer', '2026-10-05', 'mapping test only']];
		expect(fields(matchHeaders(headers, cells, employees))).toEqual(['employee_code', 'full_name', 'email_normalized', 'job_role', 'joining_date', null]);
	});

	test('abbreviations and different words for the same thing', () => {
		const headers = ['Emp ID', 'Employee Name', 'E-mail', 'Designation', 'DOJ', 'Manager', 'Status'];
		const cells = [['E1', 'Asha Rao', 'asha@x.io', 'QA', '12/03/2024', 'E9', 'active']];
		expect(fields(matchHeaders(headers, cells, employees))).toEqual(['employee_code', 'full_name', 'email_normalized', 'job_role', 'joining_date', 'reports_to_employee_id', 'employment_status']);
	});

	test('exact names are high confidence; guesses are medium', () => {
		const m = matchHeaders(['full_name', 'Joined On'], [['A', '2024-01-02']], employees);
		expect(m[0].confidence).toBe('high');
		expect(m[1].field).toBe('joining_date');
	});

	test('a field is claimed once, by the best header', () => {
		const m = matchHeaders(['Name', 'Full Name'], [['x', 'y']], employees);
		expect(fields(m).filter((f) => f === 'full_name')).toHaveLength(1);
		expect(m[1].field).toBe('full_name');
	});

	test('values break ties: a column of emails is the email field whatever it is called', () => {
		const m = matchHeaders(['Contact'], [['a@b.co'], ['c@d.co']], employees);
		expect(m[0] && m[0].field).toBe('email_normalized');
	});

	test('values that do not fit the type reject a name match', () => {
		const m = matchHeaders(['Joining Date'], [['Designer'], ['Tester']], employees);
		expect(m[0]).toBeNull();
	});

	test('unrelated headers stay unmatched and blank headers are skipped', () => {
		expect(fields(matchHeaders(['', 'Favourite colour'], [['', 'blue']], employees))).toEqual([null, null]);
	});

	test('building blocks', () => {
		expect(jaroWinkler('abc', 'abc')).toBe(1);
		expect(nameScore('Staff No', 'employee_code')).toBeGreaterThan(0.85);
		expect(fit(['2026-01-01', '2026-02-02'], { type: 'date' })).toBe(1);
		expect(fit(['x'], { type: 'date' })).toBe(0);
		expect(fit([''], { type: 'date' })).toBeNull();
	});

	test('a confirmed mapping is remembered for the same module and header row, on this device only', () => {
		const headers = ['Employee Code', 'Name'];
		window.localStorage.clear();
		expect(rememberedMapping('employees', headers, employees)).toBeNull();
		rememberMapping('employees', headers, ['employee_code', 'full_name']);
		expect(rememberedMapping('employees', headers, employees)).toEqual(['employee_code', 'full_name']);
		expect(rememberedMapping('projects', headers, employees)).toBeNull();
		expect(headerSignature(['Employee Code'])).toBe(headerSignature(['employee-code']));
	});
});
