/**
 * Sheet tab list (pure + localStorage). Only ids, record types and names are remembered on this
 * device: edits, selection, search and formatting never ride along, and the records themselves
 * always come from the API.
 */
const KEY = 'company360.sheetTabs';
const MAX_TABS = 12;
export const MAX_NAME = 30;

const empty = () => ({ tabs: [], active: null, seq: 0 });

export function loadStore() {
	try {
		const raw = JSON.parse(window.localStorage.getItem(KEY) || 'null');
		if (!raw || !Array.isArray(raw.tabs)) return empty();
		const tabs = raw.tabs
			.filter((t) => t && /^s\d+$/.test(t.id) && typeof t.resource === 'string' && typeof t.name === 'string')
			.slice(0, MAX_TABS)
			.map((t) => ({ id: t.id, resource: t.resource, name: cleanName(t.name) || t.id }));
		const seq = Math.max(Number.isInteger(raw.seq) ? raw.seq : 0, ...tabs.map((t) => Number(t.id.slice(1))), 0);
		return { tabs, active: typeof raw.active === 'string' ? raw.active : null, seq };
	} catch {
		return empty();
	}
}

export function saveStore(store) {
	try {
		window.localStorage.setItem(KEY, JSON.stringify({ tabs: store.tabs.map(({ id, resource, name }) => ({ id, resource, name })), active: store.active, seq: store.seq }));
	} catch {
		/* storage unavailable: tabs just reset next visit */
	}
}

export const cleanName = (name) => String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);

/** Appends "Sheet N" (N never reused, like a spreadsheet) for a record type and makes it active. */
export function addTab(store, resource) {
	if (store.tabs.length >= MAX_TABS) return store;
	const seq = store.seq + 1;
	return { tabs: [...store.tabs, { id: `s${seq}`, resource, name: `Sheet ${seq}` }], active: `s${seq}`, seq };
}

/**
 * Makes a stored tab list consistent with what is available now and with the ?module= the user
 * arrived with: unknown record types are dropped, a requested module activates its tab (creating
 * one when none exists), and there is always at least one tab.
 */
export function reconcile(store, available, wanted) {
	const kept = store.tabs.filter((t) => available.includes(t.resource));
	// Keep the same object when nothing changes so the caller's setState bails out instead of re-rendering.
	let next = kept.length === store.tabs.length ? store : { ...store, tabs: kept };
	if (wanted && available.includes(wanted)) {
		const current = next.tabs.find((t) => t.id === next.active);
		if (!current || current.resource !== wanted) {
			const existing = next.tabs.find((t) => t.resource === wanted);
			next = existing ? { ...next, active: existing.id } : addTab(next, wanted);
		}
	}
	if (!next.tabs.length && available.length) next = addTab(next, available[0]);
	if (next.tabs.length && !next.tabs.some((t) => t.id === next.active)) next = { ...next, active: next.tabs[0].id };
	return next;
}

export function renameTab(store, id, name) {
	const clean = cleanName(name);
	if (!clean) return store;
	return { ...store, tabs: store.tabs.map((t) => (t.id === id ? { ...t, name: clean } : t)) };
}

/** Removes a tab (never the last one); the neighbour becomes active when the closed tab was. */
export function removeTab(store, id) {
	if (store.tabs.length <= 1) return store;
	const i = store.tabs.findIndex((t) => t.id === id);
	if (i < 0) return store;
	const tabs = store.tabs.filter((t) => t.id !== id);
	const active = store.active === id ? tabs[Math.max(0, i - 1)].id : store.active;
	return { ...store, tabs, active };
}
