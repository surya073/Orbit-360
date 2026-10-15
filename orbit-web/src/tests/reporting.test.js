import { act, renderHook } from '@testing-library/react';
import useTreeHistory from '../features/reporting/useTreeHistory';
import { assign, canAssign, layoutTree, nodesFromTree, planParts, removeNode, seedFromSheet, setRole, treeFromNodes, treeStats, initialsOf, hashIndex } from '../features/reporting/treeModel';
import { buildReportingModel, layoutPart } from '../features/presentations/reportingSlides';
import { buildSlides } from '../features/presentations/deckSlides';

const emp = (id, name, extra = {}) => ({ id, name, ...extra });
const nameOf = (id) => `Person ${id}`;
const chain = () => assign(assign(assign({}, '1'), '2', '1'), '3', '2'); // 1 > 2 > 3

describe('reporting tree validation', () => {
	test('an employee cannot report to themselves', () => {
		const tree = assign({}, '1');
		expect(canAssign(tree, '1', '1').ok).toBe(false);
		expect(() => assign(tree, '1', '1')).toThrow(/themselves/);
	});

	test('circular reporting lines are rejected, including indirect ones', () => {
		const tree = chain();
		expect(canAssign(tree, '1', '3').ok).toBe(false);
		expect(canAssign(tree, '1', '2').ok).toBe(false);
		expect(() => assign(tree, '1', '3')).toThrow(/circular/);
		expect(canAssign(tree, '3', '1').ok).toBe(true); // moving up is fine
	});

	test('the manager must already be in the structure', () => {
		expect(canAssign({}, '2', '9').ok).toBe(false);
	});

	test('moving an employee keeps one manager and their role label', () => {
		let tree = setRole(chain(), '3', 'Developer');
		tree = assign(tree, '3', '1');
		expect(tree['3']).toEqual({ parentId: '1', roleLabel: 'Developer' });
		expect(Object.keys(tree)).toHaveLength(3); // no duplicate node
	});

	test('removing a node keeps the employee out of the tree only; reports move up', () => {
		const tree = removeNode(chain(), '2');
		expect(tree['2']).toBeUndefined();
		expect(tree['3'].parentId).toBe('1');
	});

	test('role labels are trimmed, bounded and can be cleared', () => {
		const tree = setRole(assign({}, '1'), '1', `  ${'x'.repeat(100)}  `);
		expect(tree['1'].roleLabel).toHaveLength(60);
		expect(setRole(tree, '1', '   ')['1'].roleLabel).toBeNull();
	});

	test('operations never mutate the previous tree', () => {
		const before = chain();
		const snapshot = JSON.stringify(before);
		assign(before, '3', '1');
		removeNode(before, '2');
		setRole(before, '1', 'Lead');
		expect(JSON.stringify(before)).toBe(snapshot);
	});

	test('nodes round trip through the API shape using string ids', () => {
		const tree = chain();
		expect(treeFromNodes(nodesFromTree(tree))).toEqual(tree);
		expect(treeFromNodes(null)).toEqual({});
	});
});

describe('seeding from the source sheet', () => {
	test('uses only manager links recorded in the sheet and skips outsiders, self links and cycles', () => {
		const tree = seedFromSheet([
			emp('1', 'A'),
			emp('2', 'B', { sheetManagerId: '1' }),
			emp('3', 'C', { sheetManagerId: '99' }), // not in roster
			emp('4', 'D', { sheetManagerId: '4' }), // self
			emp('5', 'E', { sheetManagerId: '6' }),
			emp('6', 'F', { sheetManagerId: '5' }), // cycle
		]);
		expect(tree['2'].parentId).toBe('1');
		expect(tree['3']).toBeUndefined();
		expect(tree['4']).toBeUndefined();
		const parents = [tree['5'].parentId, tree['6'].parentId];
		expect(parents.filter(Boolean)).toHaveLength(1); // exactly one of the two links survives
	});

	test('nothing is invented when the sheet has no managers', () => {
		expect(seedFromSheet([emp('1', 'A'), emp('2', 'B')])).toEqual({});
	});
});

describe('layout and stats', () => {
	test('parents are centred over children and levels are counted', () => {
		const tree = assign(assign(assign({}, '1'), '2', '1'), '3', '1');
		const l = layoutTree(tree, { nameOf, nodeW: 100, nodeH: 50, gapX: 20, gapY: 30 });
		expect(l.levels).toBe(2);
		expect(l.pos.get('1').x).toBeCloseTo((l.pos.get('2').x + l.pos.get('3').x) / 2);
		expect(l.edges).toHaveLength(2);
		expect(treeStats(tree, 5)).toEqual({ mapped: 3, levels: 2, roots: 1, unmapped: 2 });
	});

	test('collapsed branches hide their reports and count them', () => {
		const l = layoutTree(chain(), { nameOf, collapsed: new Set(['1']) });
		expect(l.pos.size).toBe(1);
		expect(l.hidden.get('1')).toBe(1);
	});

	test('an empty tree lays out to nothing', () => {
		const l = layoutTree({}, { nameOf });
		expect(l.width).toBe(0);
		expect(planParts({}, { nameOf, box: { w: 1000, h: 600 } })).toEqual([]);
	});

	test('a small tree fits one part; a wide one is split into overview and branches', () => {
		const box = { w: 1728, h: 620 };
		expect(planParts(chain(), { nameOf, box })).toEqual([expect.objectContaining({ kind: 'all' })]);
		let big = assign({}, '1');
		for (let i = 2; i <= 60; i += 1) big = assign(big, String(i), '1');
		for (let i = 61; i <= 120; i += 1) big = assign(big, String(i), String(2 + (i % 10)));
		const parts = planParts(big, { nameOf, box });
		expect(parts.length).toBeGreaterThan(1);
		expect(parts.length).toBeLessThanOrEqual(12);
	});
});

describe('avatar helpers', () => {
	test('initials and tones are consistent', () => {
		expect(initialsOf('Asha Rao Iyer')).toBe('AR');
		expect(initialsOf('')).toBe('?');
		expect(hashIndex('Asha', 5)).toBe(hashIndex('Asha', 5));
	});
});

describe('undo / redo history', () => {
	test('tracks dirty state, undo and redo without any network', () => {
		const { result } = renderHook(() => useTreeHistory());
		act(() => result.current.load({}));
		expect(result.current.dirty).toBe(false);
		act(() => result.current.apply((t) => assign(t, '1')));
		act(() => result.current.apply((t) => assign(t, '2', '1')));
		expect(result.current.dirty).toBe(true);
		act(() => result.current.undo());
		expect(Object.keys(result.current.tree)).toEqual(['1']);
		expect(result.current.canRedo).toBe(true);
		act(() => result.current.redo());
		expect(Object.keys(result.current.tree)).toEqual(['1', '2']);
		act(() => result.current.markSaved(result.current.tree));
		expect(result.current.dirty).toBe(false);
	});

	test('edits with the same key coalesce into one undo step', () => {
		const { result } = renderHook(() => useTreeHistory());
		act(() => result.current.load(assign({}, '1')));
		act(() => result.current.apply((t) => setRole(t, '1', 'D'), 'role:1'));
		act(() => result.current.apply((t) => setRole(t, '1', 'De'), 'role:1'));
		act(() => result.current.apply((t) => setRole(t, '1', 'Dev'), 'role:1'));
		act(() => result.current.undo());
		expect(result.current.tree['1'].roleLabel).toBeNull();
		expect(result.current.canUndo).toBe(false);
	});
});

describe('presentation slide data', () => {
	const employees = [emp('1', 'Lead One'), emp('2', 'Dev Two'), emp('3', 'Dev Three'), emp('4', 'Unmapped Four')];
	const saved = {
		team: { id: '7', name: 'Delivery' },
		employees,
		nodes: [
			{ employeeId: '1', parentId: null, roleLabel: 'Delivery Lead' },
			{ employeeId: '2', parentId: '1', roleLabel: 'Developer' },
			{ employeeId: '3', parentId: '1', roleLabel: null },
			{ employeeId: '99', parentId: '1', roleLabel: null }, // stale: employee no longer on the roster
		],
	};

	test('no saved structure means no slide and no fabricated hierarchy', () => {
		expect(buildReportingModel(null)).toBeNull();
		expect(buildReportingModel({ team: null, employees, nodes: [] })).toBeNull();
		const slides = buildSlides([{ type: 'section', section: 'reporting_structure', title: 'Team' }], { reporting: { status: 'ready', model: null } });
		expect(slides.map((s) => s.kind)).toEqual(['opening', 'closing']);
	});

	test('builds the model from real employees only and drops stale nodes', () => {
		const model = buildReportingModel(saved);
		expect(Object.keys(model.tree).sort()).toEqual(['1', '2', '3']);
		expect(model.stats).toEqual({ mapped: 3, levels: 2, roots: 1, unmapped: 1 });
		const { layout, k } = layoutPart(model, model.parts[0]);
		expect(layout.pos.size).toBe(3);
		expect(k).toBeGreaterThan(0);
	});

	test('the slide sits where the section is in the deck, with loading and error states', () => {
		const deck = [{ type: 'section', section: 'executive_summary' }, { type: 'section', section: 'reporting_structure' }];
		const kinds = (reporting) => buildSlides(deck, { reporting }).map((s) => s.kind);
		expect(kinds({ status: 'ready', model: buildReportingModel(saved) })).toEqual(['opening', 'deck', 'reporting', 'closing']);
		expect(kinds({ status: 'loading' })).toEqual(['opening', 'deck', 'reporting-state', 'closing']);
		expect(kinds({ status: 'error', error: 'x' })).toEqual(['opening', 'deck', 'reporting-state', 'closing']);
	});
});
