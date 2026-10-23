/**
 * The free-form slide model of the presentation studio (pure, no React). A "custom" slide is a background plus objects on a
 * 1920x1080 canvas; the server sanitises exactly this shape (functions/orbit_funtion/src/validators/slideSchema.js), so keep the
 * two in step. Colours are hex or a theme keyword ("theme:accent"), so a slide follows the deck's theme when it wants to.
 */

export const CANVAS_W = 1920;
export const CANVAS_H = 1080;
export const MAX_OBJECTS = 40;

export const uid = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 4);

export const THEME_COLORS = [
	{ id: 'theme:text', label: 'Text', css: 'var(--text)' },
	{ id: 'theme:muted', label: 'Muted', css: 'var(--text-muted)' },
	{ id: 'theme:accent', label: 'Accent', css: 'var(--accent)' },
	{ id: 'theme:surface', label: 'Card', css: 'var(--surface)' },
	{ id: 'theme:bg', label: 'Background', css: 'var(--bg)' },
	{ id: 'theme:success', label: 'Good', css: 'var(--success)' },
	{ id: 'theme:warning', label: 'Warning', css: 'var(--warning)' },
	{ id: 'theme:danger', label: 'Risk', css: 'var(--danger)' },
	{ id: 'theme:info', label: 'Info', css: 'var(--info)' },
	{ id: 'theme:chart1', label: 'Chart 1', css: 'var(--chart-1)' },
	{ id: 'theme:chart2', label: 'Chart 2', css: 'var(--chart-2)' },
	{ id: 'theme:chart3', label: 'Chart 3', css: 'var(--chart-3)' },
];
const THEME_CSS = Object.fromEntries(THEME_COLORS.map((c) => [c.id, c.css]));

/** A colour value as CSS ("theme:accent" -> var(--accent), hex stays hex, anything else is transparent). */
export const colorCss = (c, fallback = 'transparent') => {
	if (!c) return fallback;
	if (THEME_CSS[c]) return THEME_CSS[c];
	if (c === 'transparent' || /^#[0-9a-fA-F]{3,8}$/.test(c)) return c;
	return fallback;
};

export const FONT_STACKS = {
	default: 'inherit',
	serif: 'Georgia, "Times New Roman", "Noto Serif", serif',
	mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
	rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, sans-serif',
};

export const ANIMATIONS = [
	{ id: 'none', label: 'None' },
	{ id: 'fade', label: 'Fade in' },
	{ id: 'rise', label: 'Rise up' },
	{ id: 'left', label: 'Slide from left' },
	{ id: 'right', label: 'Slide from right' },
	{ id: 'zoom', label: 'Zoom in' },
	{ id: 'type', label: 'Wipe (typewriter)' },
];
export const HOVERS = [
	{ id: 'none', label: 'None' },
	{ id: 'lift', label: 'Lift' },
	{ id: 'glow', label: 'Glow' },
	{ id: 'grow', label: 'Grow' },
	{ id: 'tilt', label: 'Tilt' },
];
export const SHAPES = [
	{ id: 'rect', label: 'Rectangle' },
	{ id: 'pill', label: 'Rounded' },
	{ id: 'ellipse', label: 'Circle' },
	{ id: 'triangle', label: 'Triangle' },
	{ id: 'line', label: 'Line' },
];

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const snap = (n) => Math.round(n);

// ---- factories ----------------------------------------------------------------------------------------------

export const makeText = (over = {}) => ({ id: uid(), kind: 'text', x: 160, y: 140, w: 900, h: 120, text: 'Click to edit text', ...over, st: { fs: 56, fw: 600, color: 'theme:text', al: 'left', va: 'top', lh: 1.15, ...(over.st || {}) } });
export const makeShape = (over = {}) => ({ id: uid(), kind: 'shape', shape: 'rect', x: 160, y: 160, w: 400, h: 240, ...over, st: { fill: 'theme:accent', op: 1, r: 0, bw: 0, bc: 'transparent', ...(over.st || {}) } });
export const makeImage = (over = {}) => ({ id: uid(), kind: 'image', x: 200, y: 160, w: 560, h: 380, src: '', alt: '', fit: 'cover', st: { r: 0 }, ...over });
export const makeButton = (over = {}) => ({ id: uid(), kind: 'button', x: 160, y: 700, w: 360, h: 88, text: 'Open the report', link: '', ...over, st: { fs: 32, fw: 600, color: 'theme:bg', fill: 'theme:accent', r: 999, al: 'center', ...(over.st || {}) } });
export const makeWidget = (type = 'kpi', over = {}) => ({ id: uid(), kind: 'widget', x: 160, y: 300, w: type === 'kpi' ? 520 : 760, h: type === 'kpi' ? 300 : 460, widget: { type, metric: defaultMetric(type), top: 5, compare: type === 'kpi' }, st: { color: 'theme:text', fill: 'theme:surface', r: 28 }, ...over });

export const WIDGET_TYPES = [
	{ id: 'kpi', label: 'Big number', hint: 'One headline figure, with the change on the previous period' },
	{ id: 'bars', label: 'Bar chart', hint: 'Hours by project, ranked' },
	{ id: 'donut', label: 'Donut', hint: 'A share of a whole' },
	{ id: 'trend', label: 'Trend line', hint: 'How a figure moves over the period' },
	{ id: 'leaders', label: 'Leaderboard', hint: 'Top people ranked, with a bar' },
];

/** Every metric a widget can show: id, label, and which widgets can draw it. */
export const WIDGET_METRICS = [
	{ id: 'billable_hours', label: 'Billable hours', types: ['kpi', 'trend'] },
	{ id: 'non_billable_hours', label: 'Non-billable hours', types: ['kpi', 'trend'] },
	{ id: 'billable_share', label: 'Billable share', types: ['kpi', 'donut'] },
	{ id: 'headcount', label: 'Employees', types: ['kpi', 'donut'] },
	{ id: 'late_rate', label: 'Late check-in rate', types: ['kpi', 'trend'] },
	{ id: 'approved_leave', label: 'Approved leave (days)', types: ['kpi'] },
	{ id: 'projects', label: 'Projects', types: ['kpi', 'donut'] },
	{ id: 'workload', label: 'Hours by project', types: ['bars', 'donut'] },
	{ id: 'top_performers', label: 'Top performers (hours)', types: ['leaders'] },
	{ id: 'best_attendance', label: 'Best attendance (on-time days)', types: ['leaders'] },
];
export const metricsFor = (type) => WIDGET_METRICS.filter((m) => m.types.includes(type));
export const defaultMetric = (type) => (metricsFor(type)[0] || WIDGET_METRICS[0]).id;
export const metricLabel = (id) => (WIDGET_METRICS.find((m) => m.id === id) || { label: id }).label;

export const makeSlide = (over = {}) => ({ type: 'custom', id: uid(), name: '', bg: { kind: 'theme' }, objects: [], notes: '', ...over });

/** A deep copy with fresh ids (duplicate slide / paste). */
export const cloneSlide = (s) => ({ ...JSON.parse(JSON.stringify(s)), id: uid(), objects: s.objects.map((o) => ({ ...JSON.parse(JSON.stringify(o)), id: uid() })) });
export const cloneObject = (o, dx = 40, dy = 40) => ({ ...JSON.parse(JSON.stringify(o)), id: uid(), x: o.x + dx, y: o.y + dy });

// ---- geometry -----------------------------------------------------------------------------------------------

export const boundsOf = (o) => ({ x: o.x, y: o.y, w: o.w, h: o.h });
export const moveObject = (o, dx, dy) => ({ ...o, x: snap(clamp(o.x + dx, -600, CANVAS_W + 600)), y: snap(clamp(o.y + dy, -600, CANVAS_H + 300)) });

/** Resize from a handle ("nw", "n", "ne", "e", "se", "s", "sw", "w"); keeps a minimum size. */
export function resizeObject(o, handle, dx, dy, keepRatio = false) {
	let { x, y, w, h } = o;
	const min = 24;
	const ratio = o.w / o.h || 1;
	if (handle.includes('e')) w = Math.max(min, o.w + dx);
	if (handle.includes('s')) h = Math.max(min, o.h + dy);
	if (handle.includes('w')) {
		w = Math.max(min, o.w - dx);
		x = o.x + (o.w - w);
	}
	if (handle.includes('n')) {
		h = Math.max(min, o.h - dy);
		y = o.y + (o.h - h);
	}
	if (keepRatio && handle.length === 2) {
		h = Math.max(min, w / ratio);
		if (handle.includes('n')) y = o.y + (o.h - h);
	}
	return { ...o, x: snap(x), y: snap(y), w: snap(w), h: snap(h) };
}

/** Clicks needed to show everything on a slide: the highest "on click" step among its animated objects. */
export const slideSteps = (slide) => (slide && slide.objects ? slide.objects.reduce((m, o) => Math.max(m, (o.anim && o.anim.step) || 0), 0) : 0);

export const slideTitle = (s, i) => {
	if (s.name) return s.name;
	const t = (s.objects || []).find((o) => o.kind === 'text' && o.text && o.text.trim());
	return t ? t.text.trim().split('\n')[0].slice(0, 40) : `Slide ${i + 1}`;
};

/** A starting point for an image box that keeps the picture's shape. */
export const fitBox = (naturalW, naturalH, maxW = 900, maxH = 560) => {
	const k = Math.min(maxW / naturalW, maxH / naturalH, 1);
	return { w: Math.round(naturalW * k), h: Math.round(naturalH * k) };
};
