/**
 * Column configuration shared by every export (and the mapping step of imports): which columns, in which order, under
 * which header. A config is { order: [field...], hidden: [field...], labels: { field: 'Header' } }.
 *
 * The list of columns that may be configured always comes from the module's own schema (the backend's field contract),
 * and a config - whether typed in the dialog or read back from storage - is sanitised against it, so a stale or edited
 * preference can never name a field the module does not offer. Labels are display text only; field names never change.
 * Preferences are cosmetic, so they live on the device (like the other `company360.*` settings), scoped by user, module
 * and purpose, and cost no server request.
 */
const PREFIX = 'company360.columns';
export const MAX_LABEL = 60;

// control characters (newlines, tabs, NUL...) become spaces, then runs of spaces collapse
const noControls = (s) => [...s].map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch)).join('');
const cleanLabel = (v) => noControls(String(v ?? '')).replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);

export const defaultConfig = (columns) => ({ order: columns.map((c) => c.field), hidden: [], labels: {} });

/** Keeps only known fields (each once), appends columns the saved config has not seen, drops blank or default labels. */
export function sanitizeConfig(config, columns) {
	const known = new Map(columns.map((c) => [c.field, c]));
	const src = config && typeof config === 'object' ? config : {};
	const order = [];
	for (const f of Array.isArray(src.order) ? src.order : []) if (typeof f === 'string' && known.has(f) && !order.includes(f)) order.push(f);
	for (const c of columns) if (!order.includes(c.field)) order.push(c.field);
	const hidden = (Array.isArray(src.hidden) ? src.hidden : []).filter((f, i, a) => typeof f === 'string' && known.has(f) && a.indexOf(f) === i);
	const labels = {};
	if (src.labels && typeof src.labels === 'object') {
		for (const [f, v] of Object.entries(src.labels)) {
			const label = cleanLabel(v);
			if (known.has(f) && label && label !== known.get(f).label) labels[f] = label;
		}
	}
	return { order, hidden, labels };
}

/** The columns to export, in the configured order, each with its header (`exportLabel`). */
export function applyConfig(config, columns) {
	const cfg = sanitizeConfig(config, columns);
	const byField = new Map(columns.map((c) => [c.field, c]));
	return cfg.order.filter((f) => !cfg.hidden.includes(f)).map((f) => ({ ...byField.get(f), exportLabel: cfg.labels[f] || byField.get(f).label }));
}

export const isDefaultConfig = (config, columns) => {
	const cfg = sanitizeConfig(config, columns);
	const def = defaultConfig(columns);
	return cfg.hidden.length === 0 && Object.keys(cfg.labels).length === 0 && cfg.order.every((f, i) => f === def.order[i]);
};

export const configKey = (userId, module, purpose = 'export') => `${PREFIX}.${userId || 'anon'}.${module}.${purpose}`;

export function loadConfig(key, columns) {
	try {
		const raw = window.localStorage.getItem(key);
		return sanitizeConfig(raw ? JSON.parse(raw) : null, columns);
	} catch {
		return defaultConfig(columns);
	}
}

export function saveConfig(key, config, columns) {
	try {
		if (isDefaultConfig(config, columns)) window.localStorage.removeItem(key);
		else window.localStorage.setItem(key, JSON.stringify(sanitizeConfig(config, columns)));
	} catch {
		/* a full or blocked store just means the choice is not remembered */
	}
}

/**
 * Spreadsheet programs run text that starts with = + - @ (or a tab / carriage return) as a formula. A leading apostrophe
 * keeps such a cell plain text. Genuine numbers (including negatives) are left alone.
 */
export function safeCell(value) {
	const s = String(value ?? '');
	if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) return `'${s}`;
	return s;
}
