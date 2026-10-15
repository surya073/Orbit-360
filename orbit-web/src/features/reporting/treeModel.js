/**
 * Pure reporting-tree logic shared by the builder and the presentation slide.
 *
 * A tree is a plain object keyed by the stable employee id (string):
 *   { [employeeId]: { parentId: string | null, roleLabel: string | null } }
 * Only employees placed in the structure are keys. parentId null = top level. Every operation
 * returns a NEW tree (so undo/redo can keep snapshots) and never touches employee source data.
 */

export const MAX_ROLE_LENGTH = 60;

/** Role names offered as suggestions only; nothing is created from them. */
export const ROLE_SUGGESTIONS = ['Developer', 'Delivery Lead', 'Business Analyst', 'Project Manager', 'QA Engineer'];

export const treeFromNodes = (nodes) => Object.fromEntries((nodes || []).map((n) => [String(n.employeeId), { parentId: n.parentId ? String(n.parentId) : null, roleLabel: n.roleLabel || null }]));

export const nodesFromTree = (tree) => Object.entries(tree).map(([employeeId, n]) => ({ employeeId, parentId: n.parentId, roleLabel: n.roleLabel || null }));

export const sameTree = (a, b) => {
	const ka = Object.keys(a);
	if (ka.length !== Object.keys(b).length) return false;
	return ka.every((k) => b[k] && b[k].parentId === a[k].parentId && (b[k].roleLabel || null) === (a[k].roleLabel || null));
};

/** parent id (or null) -> child ids, in the order given by `nameOf` (stable for equal names). */
export function childrenMap(tree, nameOf = (id) => id) {
	const map = new Map();
	for (const [id, n] of Object.entries(tree)) {
		const key = n.parentId && tree[n.parentId] ? n.parentId : null; // a dangling manager reads as top level
		if (!map.has(key)) map.set(key, []);
		map.get(key).push(id);
	}
	const cmp = (a, b) => String(nameOf(a)).localeCompare(String(nameOf(b)), undefined, { sensitivity: 'base' }) || Number(a) - Number(b);
	for (const list of map.values()) list.sort(cmp);
	return map;
}

export function descendantsOf(tree, id) {
	const kids = childrenMap(tree);
	const out = new Set();
	const stack = [...(kids.get(id) || [])];
	while (stack.length) {
		const cur = stack.pop();
		if (out.has(cur)) continue;
		out.add(cur);
		stack.push(...(kids.get(cur) || []));
	}
	return out;
}

export function ancestorsOf(tree, id) {
	const out = [];
	const seen = new Set([id]);
	let cur = tree[id] && tree[id].parentId;
	while (cur && tree[cur] && !seen.has(cur)) {
		out.push(cur);
		seen.add(cur);
		cur = tree[cur].parentId;
	}
	return out;
}

/** Can `id` be made a direct report of `parentId` (null = top level)? Returns { ok, reason }. */
export function canAssign(tree, id, parentId) {
	if (!id) return { ok: false, reason: 'No employee selected' };
	if (parentId === null || parentId === undefined) return { ok: true };
	if (String(parentId) === String(id)) return { ok: false, reason: 'An employee cannot report to themselves' };
	if (!tree[parentId]) return { ok: false, reason: 'The manager must be added to the structure first' };
	if (tree[id] && descendantsOf(tree, id).has(String(parentId))) return { ok: false, reason: 'That would create a circular reporting line: the manager already reports (directly or indirectly) to this employee' };
	return { ok: true };
}

/** Place a new employee, or move a placed one, under `parentId`. Throws on an invalid move. */
export function assign(tree, id, parentId = null) {
	const check = canAssign(tree, id, parentId);
	if (!check.ok) throw new Error(check.reason);
	const prev = tree[id];
	return { ...tree, [id]: { parentId: parentId === undefined ? null : parentId, roleLabel: prev ? prev.roleLabel : null } };
}

/** Remove from the structure (the employee record is untouched). Direct reports move up to the manager above. */
export function removeNode(tree, id) {
	if (!tree[id]) return tree;
	const up = tree[id].parentId && tree[tree[id].parentId] ? tree[id].parentId : null;
	const next = {};
	for (const [k, n] of Object.entries(tree)) {
		if (k === id) continue;
		next[k] = n.parentId === id ? { ...n, parentId: up } : n;
	}
	return next;
}

export function setRole(tree, id, label) {
	if (!tree[id]) return tree;
	const clean = String(label || '').replace(/\s+/g, ' ').trim().slice(0, MAX_ROLE_LENGTH);
	return { ...tree, [id]: { ...tree[id], roleLabel: clean || null } };
}

/**
 * Starting point built ONLY from the manager the source sheet already records for each employee.
 * Links to people outside the roster, and links that would form a cycle, are skipped.
 */
export function seedFromSheet(employees) {
	const byId = new Map(employees.map((e) => [e.id, e]));
	let tree = {};
	const linked = employees.filter((e) => e.sheetManagerId && e.sheetManagerId !== e.id && byId.has(e.sheetManagerId));
	const involved = new Set(linked.flatMap((e) => [e.id, e.sheetManagerId]));
	for (const id of involved) tree[id] = { parentId: null, roleLabel: null };
	for (const e of linked) {
		if (canAssign(tree, e.id, e.sheetManagerId).ok) tree = { ...tree, [e.id]: { ...tree[e.id], parentId: e.sheetManagerId } };
	}
	return tree;
}

/** Sheet-seedable relationships: how many employees record a manager that is in the roster. */
export const sheetLinkCount = (employees) => {
	const ids = new Set(employees.map((e) => e.id));
	return employees.filter((e) => e.sheetManagerId && e.sheetManagerId !== e.id && ids.has(e.sheetManagerId)).length;
};

export function treeStats(tree, rosterSize) {
	const kids = childrenMap(tree);
	let levels = 0;
	const walk = (id, d) => {
		levels = Math.max(levels, d);
		for (const c of kids.get(id) || []) walk(c, d + 1);
	};
	const roots = kids.get(null) || [];
	roots.forEach((r) => walk(r, 1));
	const mapped = Object.keys(tree).length;
	return { mapped, levels, roots: roots.length, unmapped: Math.max(rosterSize - mapped, 0) };
}

/**
 * Tidy tree layout (parents centred over their children, leaves on an even grid), laid out as a
 * forest from left to right. Positions are node CENTRES on a canvas of `width` x `height`.
 *   collapsed : Set of ids whose children are hidden
 *   rootIds   : lay out only these subtrees (default: every top-level employee)
 *   maxDepth  : relative depth limit (0 = the roots only); deeper levels are hidden and counted in `hidden`
 */
export function layoutTree(tree, { nameOf, nodeW = 180, nodeH = 120, gapX = 28, gapY = 70, collapsed = new Set(), rootIds, maxDepth = Infinity } = {}) {
	const kids = childrenMap(tree, nameOf);
	const roots = (rootIds || kids.get(null) || []).filter((r) => tree[r]);
	const pos = new Map();
	const edges = [];
	const hidden = new Map(); // id -> number of direct reports not shown
	let cursor = 0;
	const place = (id, depth) => {
		const children = kids.get(id) || [];
		const showKids = children.length > 0 && !collapsed.has(id) && depth < maxDepth;
		if (children.length && !showKids) hidden.set(id, children.length);
		let x;
		if (!showKids) {
			x = cursor + nodeW / 2;
			cursor += nodeW + gapX;
		} else {
			const xs = children.map((c) => {
				edges.push({ from: id, to: c });
				return place(c, depth + 1);
			});
			x = (xs[0] + xs[xs.length - 1]) / 2;
		}
		pos.set(id, { x, y: depth * (nodeH + gapY) + nodeH / 2, depth });
		return x;
	};
	roots.forEach((r) => place(r, 0));
	const maxDepthSeen = Math.max(0, ...[...pos.values()].map((p) => p.depth));
	return { pos, edges, hidden, roots, width: Math.max(cursor - gapX, 0), height: pos.size ? (maxDepthSeen + 1) * nodeH + maxDepthSeen * gapY : 0, nodeW, nodeH, levels: pos.size ? maxDepthSeen + 1 : 0 };
}

/** View transform that fits a layout in a box: { k, x, y } for `translate(x,y) scale(k)`. */
export function fitView(layout, box, { pad = 32, maxK = 1.25, minK = 0.05 } = {}) {
	if (!layout.width || !layout.height) return { k: 1, x: 0, y: 0 };
	const k = Math.min(Math.max(Math.min((box.w - pad * 2) / layout.width, (box.h - pad * 2) / layout.height), minK), maxK);
	return { k, x: (box.w - layout.width * k) / 2, y: Math.max((box.h - layout.height * k) / 2, pad / 2) };
}

/**
 * Presentation plan: which groups of the tree become slides, so nothing shrinks below a readable
 * size. Each part is { rootIds, maxDepth, title? }.
 *  1. the whole tree on one slide when it stays readable;
 *  2. otherwise an overview of the top levels, then one slide per branch (split further if needed).
 */
export function planParts(tree, { nameOf, box, minScale = 0.62, nodeW = 200, nodeH = 150, gapX = 28, gapY = 80, maxParts = 12 }) {
	const kids = childrenMap(tree, nameOf);
	const roots = kids.get(null) || [];
	if (!roots.length) return [];
	const scaleOf = (rootIds, maxDepth = Infinity) => {
		const l = layoutTree(tree, { nameOf, nodeW, nodeH, gapX, gapY, rootIds, maxDepth });
		return Math.min(box.w / Math.max(l.width, 1), box.h / Math.max(l.height, 1));
	};
	if (scaleOf(roots) >= minScale) return [{ rootIds: roots, maxDepth: Infinity, kind: 'all' }];
	const parts = [];
	let overviewDepth = 1;
	while (overviewDepth < 4 && scaleOf(roots, overviewDepth + 1) >= minScale) overviewDepth += 1;
	const hiddenOf = (rootIds, maxDepth) => [...layoutTree(tree, { nameOf, nodeW, nodeH, gapX, gapY, rootIds, maxDepth }).hidden.keys()];
	const branch = (id) => {
		if (parts.length >= maxParts) return;
		if (scaleOf([id]) >= minScale) {
			parts.push({ rootIds: [id], maxDepth: Infinity, kind: 'branch' });
			return;
		}
		let depth = 1;
		while (depth < 4 && scaleOf([id], depth + 1) >= minScale) depth += 1;
		parts.push({ rootIds: [id], maxDepth: depth, kind: 'branch' });
		hiddenOf([id], depth).forEach(branch);
	};
	if (scaleOf(roots, overviewDepth) >= minScale) {
		parts.push({ rootIds: roots, maxDepth: overviewDepth, kind: 'overview' });
		hiddenOf(roots, overviewDepth).forEach(branch);
	} else {
		roots.forEach(branch);
	}
	return parts.slice(0, maxParts);
}

/** Initials for the avatar: first letters of the first two words. */
export const initialsOf = (name) =>
	String(name || '')
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((w) => Array.from(w)[0] || '')
		.join('')
		.toUpperCase() || '?';

/** Stable small integer from text, used to pick a consistent avatar/role tone. */
export const hashIndex = (text, mod) => {
	let h = 0;
	for (const ch of String(text)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
	return h % mod;
};
