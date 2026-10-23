'use strict';

/**
 * Sanitiser for the free-form ("custom") slides of the presentation studio. A saved deck is stored and replayed to other
 * people, so nothing the client sends is trusted: every object is rebuilt from a whitelist, numbers are clamped, colours
 * are hex or theme keywords only, links are http(s)/mailto/in-deck only, and image sources are https URLs or small
 * inline raster images (never SVG, which can carry script). Unknown properties are dropped.
 */

const MAX_OBJECTS = 40;
const KINDS = ['text', 'shape', 'image', 'widget', 'button'];
const SHAPES = ['rect', 'ellipse', 'pill', 'line', 'triangle'];
const ANIM_IN = ['none', 'fade', 'rise', 'left', 'right', 'zoom', 'type'];
const HOVER = ['none', 'lift', 'glow', 'grow', 'tilt'];
const WIDGETS = ['kpi', 'bars', 'donut', 'trend', 'leaders'];
const ALIGN = ['left', 'center', 'right'];
const VALIGN = ['top', 'middle', 'bottom'];
const FONTS = ['default', 'serif', 'mono', 'rounded'];
const FITS = ['cover', 'contain'];
const BG_KINDS = ['theme', 'solid', 'gradient'];
const TRANSITIONS = ['auto', 'slide', 'zoom', 'blur', 'flip', 'wipe', 'rise']; // slide transitions the player knows
const THEME_ID = /^[a-z0-9-]{1,30}$/; // a presentation theme id; the player falls back when it does not know it
const WEIGHTS = [300, 400, 500, 600, 700, 800];

const COLOR = /^(#[0-9a-fA-F]{3,8}|theme:[a-z0-9]{2,12}|transparent)$/;
const ID = /^[A-Za-z0-9_-]{1,24}$/;
const DATA_IMAGE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const HTTPS = /^https:\/\/[^\s"'<>]{3,580}$/;
const LINK = /^(https?:\/\/[^\s"'<>]{3,380}|mailto:[^\s"'<>]{3,120}|#slide-\d{1,3})$/;

const num = (v, lo, hi, dflt) => {
	const n = Number(v);
	return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n * 100) / 100)) : dflt;
};
const pick = (v, list, dflt) => (list.includes(v) ? v : dflt);
const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max) : undefined);
const color = (v, dflt) => (typeof v === 'string' && COLOR.test(v) ? v : dflt);
const idOf = (v, fallback) => (typeof v === 'string' && ID.test(v) ? v : fallback);

function cleanStyle(st) {
	const s = st && typeof st === 'object' ? st : {};
	const out = {};
	if (s.fs !== undefined) out.fs = num(s.fs, 8, 400, 40);
	if (s.fw !== undefined) out.fw = WEIGHTS.includes(Number(s.fw)) ? Number(s.fw) : 500;
	if (s.it) out.it = true;
	if (s.ul) out.ul = true;
	if (s.al !== undefined) out.al = pick(s.al, ALIGN, 'left');
	if (s.va !== undefined) out.va = pick(s.va, VALIGN, 'top');
	if (s.ff !== undefined) out.ff = pick(s.ff, FONTS, 'default');
	if (s.color !== undefined) out.color = color(s.color, 'theme:text');
	if (s.fill !== undefined) out.fill = color(s.fill, 'transparent');
	if (s.fill2 !== undefined) out.fill2 = color(s.fill2, 'transparent');
	if (s.bc !== undefined) out.bc = color(s.bc, 'transparent');
	if (s.bw !== undefined) out.bw = num(s.bw, 0, 40, 0);
	if (s.r !== undefined) out.r = num(s.r, 0, 600, 0);
	if (s.op !== undefined) out.op = num(s.op, 0, 1, 1);
	if (s.ls !== undefined) out.ls = num(s.ls, -5, 40, 0);
	if (s.lh !== undefined) out.lh = num(s.lh, 0.8, 3, 1.2);
	if (s.sh) out.sh = true;
	return out;
}

function cleanObject(o, i) {
	if (!o || typeof o !== 'object' || !KINDS.includes(o.kind)) return null;
	const out = {
		id: idOf(o.id, `o${i + 1}`),
		kind: o.kind,
		x: num(o.x, -600, 2400, 0),
		y: num(o.y, -600, 1400, 0),
		w: num(o.w, 4, 2400, 200),
		h: num(o.h, 2, 1400, 100),
		st: cleanStyle(o.st),
	};
	if (o.rot !== undefined) out.rot = num(o.rot, -360, 360, 0);
	if (o.kind === 'text' || o.kind === 'button') out.text = str(o.text, 1500) || '';
	if (o.kind === 'shape') out.shape = pick(o.shape, SHAPES, 'rect');
	if (o.kind === 'image') {
		const src = typeof o.src === 'string' ? o.src : '';
		out.src = HTTPS.test(src) || (DATA_IMAGE.test(src) && src.length <= 14000) ? src : '';
		out.alt = str(o.alt, 160) || '';
		out.fit = pick(o.fit, FITS, 'cover');
	}
	if (o.kind === 'widget') {
		const w = o.widget && typeof o.widget === 'object' ? o.widget : {};
		out.widget = { type: pick(w.type, WIDGETS, 'kpi'), metric: str(w.metric, 40) || 'billable_hours', top: num(w.top, 1, 10, 5), compare: Boolean(w.compare) };
	}
	if (typeof o.link === 'string' && LINK.test(o.link)) out.link = o.link;
	const a = o.anim && typeof o.anim === 'object' ? o.anim : {};
	if (pick(a.in, ANIM_IN, 'none') !== 'none') out.anim = { in: a.in, delay: num(a.delay, 0, 10000, 0), dur: num(a.dur, 100, 3000, 600), step: Math.round(num(a.step, 0, 20, 0)) };
	if (pick(o.hover, HOVER, 'none') !== 'none') out.hover = o.hover;
	return out;
}

/** One custom slide, rebuilt from the whitelist. */
function cleanCustomSlide(s, i) {
	const bg = s.bg && typeof s.bg === 'object' ? s.bg : {};
	const kind = pick(bg.kind, BG_KINDS, 'theme');
	const objects = (Array.isArray(s.objects) ? s.objects : []).slice(0, MAX_OBJECTS).map(cleanObject).filter(Boolean);
	const seen = new Set();
	objects.forEach((o, n) => {
		if (seen.has(o.id)) o.id = `o${n + 1}x${i}`;
		seen.add(o.id);
	});
	return {
		type: 'custom',
		id: idOf(s.id, `s${i + 1}`),
		name: str(s.name, 80) || undefined,
		bg: { kind, ...(kind !== 'theme' ? { color: color(bg.color, '#111111') } : {}), ...(kind === 'gradient' ? { color2: color(bg.color2, '#333333'), angle: num(bg.angle, 0, 360, 135) } : {}) },
		objects,
		notes: str(s.notes, 1000) || undefined,
		theme: typeof s.theme === 'string' && THEME_ID.test(s.theme) ? s.theme : undefined,
		transition: TRANSITIONS.includes(s.transition) ? s.transition : undefined,
	};
}

module.exports = { cleanCustomSlide, cleanObject, MAX_OBJECTS };
