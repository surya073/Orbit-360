/**
 * Cell formatting model (pure). Formatting is presentation-only metadata kept on this device:
 * the record API has no field for it, so it is never sent to the backend and never part of a
 * record. Colours are stored as palette ids (not CSS) so every theme resolves its own readable
 * value.
 */

export const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 36];
export const DEFAULT_FONT_SIZE = 13; // the grid's own size (--fs-sm), shown when a cell has none
export const MIN_FONT_SIZE = 6;
export const MAX_FONT_SIZE = 72;
export const SHEET_CURRENCY = 'GBP'; // the currency button's symbol and code
export const ZOOM_STEPS = [50, 75, 90, 100, 110, 125, 150, 175, 200];
export const ALIGNS = ['left', 'center', 'right'];
export const VALIGNS = ['top', 'middle', 'bottom'];

/** Font families offered by the toolbar: id -> CSS stack (system fonts only; nothing is downloaded). */
export const FONT_FAMILIES = [
	{ id: 'arial', label: 'Arial', css: 'Arial, Helvetica, sans-serif' },
	{ id: 'georgia', label: 'Georgia', css: 'Georgia, serif' },
	{ id: 'times', label: 'Times New Roman', css: "'Times New Roman', Times, serif" },
	{ id: 'courier', label: 'Courier New', css: "'Courier New', Courier, monospace" },
	{ id: 'verdana', label: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
	{ id: 'trebuchet', label: 'Trebuchet MS', css: "'Trebuchet MS', Helvetica, sans-serif" },
];
const fontById = Object.fromEntries(FONT_FAMILIES.map((f) => [f.id, f]));

/** Number formats: t = auto (fixed decimals only) | number | percent | currency | text (shown as typed). */
export const NUMBER_TYPES = ['auto', 'number', 'percent', 'currency', 'text'];
export const MAX_DECIMALS = 8;
const NUMERIC = /^-?\d+(\.\d+)?$/;
export const isNumericText = (text) => NUMERIC.test(String(text ?? '').trim());
export const decimalsOf = (text) => {
	const m = String(text ?? '').match(/\.(\d+)$/);
	return m ? m[1].length : 0;
};

/** The text a cell shows under a number format. Anything that is not a plain number is left as it is. */
export function formatNumberText(text, nf) {
	const raw = String(text ?? '').trim();
	if (!nf || nf.t === 'text' || !NUMERIC.test(raw)) return text;
	const n = Number(raw);
	if (!Number.isFinite(n)) return text;
	const d = Number.isInteger(nf.d) ? nf.d : nf.t === 'auto' ? decimalsOf(raw) : 2;
	const opts = { minimumFractionDigits: d, maximumFractionDigits: d };
	try {
		if (nf.t === 'percent') return new Intl.NumberFormat('en-GB', { ...opts, style: 'percent' }).format(n);
		if (nf.t === 'currency') return new Intl.NumberFormat('en-GB', { ...opts, style: 'currency', currency: SHEET_CURRENCY }).format(n);
		if (nf.t === 'number') return new Intl.NumberFormat('en-GB', opts).format(n);
		return n.toFixed(d);
	} catch {
		return text;
	}
}

/** Decimal places currently shown for a value, so the +/- decimal buttons step from what you see. */
export const shownDecimals = (text, nf) => {
	const shown = formatNumberText(text, nf);
	return decimalsOf(String(shown).replace(/[^0-9.]/g, ''));
};

/** Cell borders are a set of edge letters: t, b, l, r. */
export const EDGES = ['t', 'b', 'l', 'r'];
export const mergeEdges = (a, b) => EDGES.filter((e) => String(a || '').includes(e) || String(b || '').includes(e)).join('');

/** Text colours: id -> CSS using theme tokens. */
export const TEXT_COLORS = [
	{ id: 'text', label: 'Default', css: 'var(--text)' },
	{ id: 'muted', label: 'Muted', css: 'var(--text-muted)' },
	{ id: 'accent', label: 'Accent', css: 'var(--accent)' },
	{ id: 'success', label: 'Green', css: 'var(--success)' },
	{ id: 'warning', label: 'Amber', css: 'var(--warning)' },
	{ id: 'danger', label: 'Red', css: 'var(--danger)' },
	{ id: 'info', label: 'Blue', css: 'var(--info)' },
];

/** Fill colours: soft tints that keep the default text readable, plus two solid fills with their own ink. */
export const FILL_COLORS = [
	{ id: 'neutral', label: 'Grey', css: 'var(--surface-3)' },
	{ id: 'accent-soft', label: 'Accent tint', css: 'var(--accent-soft)' },
	{ id: 'success-soft', label: 'Green tint', css: 'var(--success-soft)' },
	{ id: 'warning-soft', label: 'Amber tint', css: 'var(--warning-soft)' },
	{ id: 'danger-soft', label: 'Red tint', css: 'var(--danger-soft)' },
	{ id: 'info-soft', label: 'Blue tint', css: 'var(--info-soft)' },
	{ id: 'accent', label: 'Accent', css: 'var(--accent)', ink: 'var(--on-accent)' },
	{ id: 'danger', label: 'Red', css: 'var(--danger)', ink: 'var(--on-accent)' },
];

const textById = Object.fromEntries(TEXT_COLORS.map((c) => [c.id, c]));
const fillById = Object.fromEntries(FILL_COLORS.map((c) => [c.id, c]));

/** A custom colour chosen with the colour picker, stored as #rrggbb (validated: the stored JSON is untrusted). */
export const isHexColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

/** Readable ink for text on a custom fill (dark on light fills, white on dark ones). */
export function inkFor(hex) {
	const n = parseInt(hex.slice(1), 16);
	const lin = (c) => {
		const v = c / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	const lum = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
	return lum > 0.32 ? '#111827' : '#ffffff';
}

/** A palette id or a custom #rrggbb -> { css, ink? }, or null when unknown. */
export const resolveText = (id) => (isHexColor(id) ? { css: id.toLowerCase() } : textById[id] || null);
export const resolveFill = (id) => (isHexColor(id) ? { css: id.toLowerCase(), ink: inkFor(id) } : fillById[id] || null);

/** Only http(s) and mailto links are ever rendered as links; everything else is rejected. */
export function safeUrl(input) {
	const raw = String(input ?? '').trim();
	if (!raw || raw.length > 2000 || /\s/.test(raw) || [...raw].some((ch) => ch.charCodeAt(0) < 32)) return null;
	const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw) ? `mailto:${raw}` : `https://${raw}`;
	let u;
	try {
		u = new URL(candidate);
	} catch {
		return null;
	}
	if (u.protocol === 'mailto:') return u.pathname ? u.href : null;
	if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
	return u.hostname.includes('.') || u.hostname === 'localhost' ? u.href : null;
}

/** The link to render for a cell: an explicit device-local link, else a value that is itself an http(s) URL. */
export function linkFor(fmt, text) {
	if (fmt && fmt.link) return safeUrl(fmt.link);
	const t = String(text ?? '').trim();
	return /^https?:\/\//i.test(t) ? safeUrl(t) : null;
}

/** Keeps only known, well-typed properties (the stored JSON is untrusted: it lives in localStorage). */
export function sanitizeCell(c) {
	if (!c || typeof c !== 'object') return null;
	const out = {};
	if (c.b === true) out.b = true;
	if (c.i === true) out.i = true;
	if (c.s === true) out.s = true;
	if (c.wrap === true) out.wrap = true;
	if (c.clip === true && !out.wrap) out.clip = true;
	if (ALIGNS.includes(c.align)) out.align = c.align;
	if (VALIGNS.includes(c.valign)) out.valign = c.valign;
	if (Number.isInteger(c.size) && c.size >= MIN_FONT_SIZE && c.size <= MAX_FONT_SIZE) out.size = c.size;
	if (typeof c.font === 'string' && fontById[c.font]) out.font = c.font;
	if (c.nf && typeof c.nf === 'object' && NUMBER_TYPES.includes(c.nf.t)) {
		out.nf = { t: c.nf.t };
		if (Number.isInteger(c.nf.d) && c.nf.d >= 0 && c.nf.d <= MAX_DECIMALS) out.nf.d = c.nf.d;
	}
	if (typeof c.bd === 'string' && /^[tblr]{1,4}$/.test(c.bd)) out.bd = mergeEdges(c.bd, '');
	if (typeof c.note === 'string' && c.note.trim()) out.note = c.note.trim().slice(0, 500);
	if (typeof c.color === 'string' && resolveText(c.color)) out.color = isHexColor(c.color) ? c.color.toLowerCase() : c.color;
	if (typeof c.fill === 'string' && resolveFill(c.fill)) out.fill = isHexColor(c.fill) ? c.fill.toLowerCase() : c.fill;
	if (typeof c.link === 'string' && safeUrl(c.link)) out.link = c.link;
	return Object.keys(out).length ? out : null;
}

/** { rowKey: { field: cell } } -> the same shape, sanitised; new-row keys are never restored. */
export function sanitizeStore(raw) {
	const out = {};
	if (!raw || typeof raw !== 'object') return out;
	for (const [key, fields] of Object.entries(raw)) {
		if (!/^r:\d+$/.test(key) || !fields || typeof fields !== 'object') continue;
		const row = {};
		for (const [field, cell] of Object.entries(fields)) {
			const clean = /^[a-z0-9_]+$/i.test(field) ? sanitizeCell(cell) : null;
			if (clean) row[field] = clean;
		}
		if (Object.keys(row).length) out[key] = row;
	}
	return out;
}

/** Inline style for a formatted cell. `zoom` scales the explicit font size with the grid. */
export function cellStyle(fmt) {
	if (!fmt) return undefined;
	const s = {};
	const fill = fmt.fill && resolveFill(fmt.fill);
	if (fill) {
		s['--cell-fill'] = fill.css; // a custom property, so selection and unsaved tints can layer over it
		if (fill.ink) s.color = fill.ink;
	}
	const text = fmt.color && resolveText(fmt.color);
	if (text) s.color = text.css;
	if (fmt.b) s.fontWeight = 700;
	if (fmt.i) s.fontStyle = 'italic';
	if (fmt.s) s.textDecoration = 'line-through';
	if (fmt.size) s.fontSize = `calc(${fmt.size}px * var(--sheet-zoom, 1))`;
	const font = fmt.font && fontById[fmt.font];
	if (font) s.fontFamily = font.css;
	if (fmt.valign) s.alignItems = fmt.valign === 'top' ? 'flex-start' : fmt.valign === 'bottom' ? 'flex-end' : 'center';
	if (fmt.bd) {
		const line = '1px solid var(--text)';
		if (fmt.bd.includes('t')) s.borderTop = line;
		if (fmt.bd.includes('b')) s.borderBottom = line;
		if (fmt.bd.includes('l')) s.borderLeft = line;
		if (fmt.bd.includes('r')) s.borderRight = line;
	}
	if (fmt.align) s.justifyContent = fmt.align === 'center' ? 'center' : fmt.align === 'right' ? 'flex-end' : 'flex-start';
	return Object.keys(s).length ? s : undefined;
}

export const zoomIn = (pct) => ZOOM_STEPS.find((z) => z > pct) || ZOOM_STEPS[ZOOM_STEPS.length - 1];
export const zoomOut = (pct) => [...ZOOM_STEPS].reverse().find((z) => z < pct) || ZOOM_STEPS[0];
