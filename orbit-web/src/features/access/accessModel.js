/**
 * Pure helpers for the Access & Permissions screen. A permission set is a `Set` of keys like
 * `employees.edit`. The catalog (from GET /access/catalog) says which modules exist and which
 * actions each supports, so a new module on the server shows up here without any code change.
 */

export const keyOf = (module, action) => `${module}.${action}`;

const moduleOf = (catalog, key) => catalog.modules.find((m) => m.key === key);

/** Every permission key in the catalog. */
export const allKeys = (catalog) => catalog.modules.flatMap((m) => m.actions.map((a) => keyOf(m.key, a)));

/**
 * Turns one checkbox on or off. Turning anything on also turns on View (a role that can edit
 * records but not see them makes no sense); turning View off turns the whole module off.
 */
export function toggle(set, catalog, module, action) {
	const m = moduleOf(catalog, module);
	const next = new Set(set);
	const key = keyOf(module, action);
	if (!m || !m.actions.includes(action)) return next;
	if (next.has(key)) {
		if (action === 'view') m.actions.forEach((a) => next.delete(keyOf(module, a)));
		else next.delete(key);
	} else {
		next.add(key);
		if (action !== 'view' && m.actions.includes('view')) next.add(keyOf(module, 'view'));
	}
	return next;
}

/** All actions of one module on or off. */
export function setModule(set, catalog, module, on) {
	const m = moduleOf(catalog, module);
	const next = new Set(set);
	if (!m) return next;
	m.actions.forEach((a) => (on ? next.add(keyOf(module, a)) : next.delete(keyOf(module, a))));
	return next;
}

/** One action (a column) on or off for every module that has it. */
export function setColumn(set, catalog, action, on) {
	let next = new Set(set);
	for (const m of catalog.modules) {
		if (!m.actions.includes(action)) continue;
		if (on) next = toggleOn(next, catalog, m.key, action);
		else next = action === 'view' ? setModule(next, catalog, m.key, false) : (next.delete(keyOf(m.key, action)), next);
	}
	return next;
}

function toggleOn(set, catalog, module, action) {
	return set.has(keyOf(module, action)) ? set : toggle(set, catalog, module, action);
}

export const setAll = (catalog, on) => new Set(on ? allKeys(catalog) : []);

/** Is a whole module / column fully on? (drives the bulk buttons' labels) */
export const moduleFull = (set, catalog, module) => {
	const m = moduleOf(catalog, module);
	return Boolean(m) && m.actions.every((a) => set.has(keyOf(module, a)));
};
export const columnFull = (set, catalog, action) => catalog.modules.filter((m) => m.actions.includes(action)).every((m) => set.has(keyOf(m.key, action)));

/** What changed between two permission sets. */
export function diff(before, after) {
	return { added: [...after].filter((k) => !before.has(k)).sort(), removed: [...before].filter((k) => !after.has(k)).sort() };
}

/** "employees.edit" -> "Edit Employees" (for confirmations). */
export function describeKey(catalog, key) {
	const [module, action] = key.split('.');
	const m = moduleOf(catalog, module);
	const a = catalog.actions.find((x) => x.key === action);
	return `${a ? a.label : action} ${m ? m.label : module}`;
}

/** Permissions of a set grouped by module, for compact displays: [{ module, label, actions: ['View', 'Edit'] }]. */
export function summarize(set, catalog) {
	return catalog.modules
		.map((m) => ({ module: m.key, label: m.label, group: m.group, actions: m.actions.filter((a) => set.has(keyOf(m.key, a))).map((a) => (catalog.actions.find((x) => x.key === a) || { label: a }).label) }))
		.filter((m) => m.actions.length > 0);
}

/** Modules grouped for display, keeping the catalog order. */
export function groupModules(catalog) {
	const groups = [];
	for (const m of catalog.modules) {
		let g = groups.find((x) => x.name === m.group);
		if (!g) groups.push((g = { name: m.group, modules: [] }));
		g.modules.push(m);
	}
	return groups;
}

/** Does this change touch who can manage access itself? Those deserve an extra warning. */
export const touchesAccessControl = (keys) => keys.some((k) => k.startsWith('access.'));
