import { shrinkBlob } from './images';
import { CANVAS_H, CANVAS_W, MAX_OBJECTS, makeShape, makeSlide, makeText, makeImage, uid } from './slideModel';

/**
 * Turns an uploaded PowerPoint (.pptx) into editable studio slides, entirely in the browser (nothing is uploaded anywhere).
 * A .pptx is a zip of XML: the slide size, the theme colours and fonts, and for each slide its background, text boxes,
 * shapes and pictures with their positions. The importer separates them the way a person would read the slide:
 *   - text boxes become text objects (size, weight, italic, colour, alignment and vertical position kept; title,
 *     subtitle and body placeholders are recognised; date, footer and slide-number placeholders are left out),
 *   - filled or outlined shapes become shape objects (rectangle, rounded, circle, triangle, line),
 *   - pictures are shrunk to fit a slide's storage budget; one that is too detailed becomes an empty picture box that
 *     keeps the place and size, ready for a link,
 *   - the background colour or gradient is kept, groups are unpacked, and tables, charts and SmartArt are reported as
 *     not imported.
 * Positions are scaled onto the 1920 x 1080 canvas (a 4:3 deck is centred).
 */

const MAX_BYTES = 40 * 1024 * 1024;
const readBuffer = (file) => (file.arrayBuffer ? file.arrayBuffer() : new Promise((resolve, reject) => {
	const r = new FileReader();
	r.onload = () => resolve(r.result);
	r.onerror = () => reject(new Error('The file could not be read.'));
	r.readAsArrayBuffer(file);
}));
const EMU_PT = 12700;
const SKIP_PLACEHOLDERS = new Set(['dt', 'ftr', 'sldNum']);
const DEFAULT_PT = { ctrTitle: 44, title: 44, subTitle: 28, body: 24 };

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const kids = (el, tag) => (el ? [...el.children].filter((c) => c.nodeName === tag) : []);
const kid = (el, tag) => kids(el, tag)[0] || null;
const attr = (el, name, d = undefined) => (el && el.getAttribute(name) !== null ? el.getAttribute(name) : d);
const num = (el, name, d = 0) => {
	const v = Number(attr(el, name));
	return Number.isFinite(v) ? v : d;
};
const parse = (xml) => new DOMParser().parseFromString(xml, 'application/xml');
const isError = (doc) => doc.getElementsByTagName('parsererror').length > 0;
const descendants = (el, tag) => [...el.getElementsByTagName(tag)];

// ---- colours ----------------------------------------------------------------------------------------------

const hex = (v) => `#${String(v).toLowerCase().padStart(6, '0').slice(0, 6)}`;
function hslOf(h) {
	const r = parseInt(h.slice(1, 3), 16) / 255;
	const g = parseInt(h.slice(3, 5), 16) / 255;
	const b = parseInt(h.slice(5, 7), 16) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return [0, 0, l];
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	const hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
	return [hue / 6, s, l];
}
function hexOf([h, s, l]) {
	const f = (p, q, t) => {
		let x = t;
		if (x < 0) x += 1;
		if (x > 1) x -= 1;
		if (x < 1 / 6) return p + (q - p) * 6 * x;
		if (x < 1 / 2) return q;
		if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
		return p;
	};
	let r = l;
	let g = l;
	let b = l;
	if (s) {
		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;
		r = f(p, q, h + 1 / 3);
		g = f(p, q, h);
		b = f(p, q, h - 1 / 3);
	}
	return `#${[r, g, b].map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('')}`;
}

function parseTheme(xml) {
	const colors = {};
	let fonts = { major: '', minor: '' };
	if (xml) {
		const doc = parse(xml);
		const scheme = doc.getElementsByTagName('a:clrScheme')[0];
		if (scheme) {
			[...scheme.children].forEach((c) => {
				const v = c.firstElementChild;
				if (v) colors[c.nodeName.replace('a:', '')] = v.nodeName === 'a:sysClr' ? hex(attr(v, 'lastClr', '000000')) : hex(attr(v, 'val', '000000'));
			});
		}
		const major = doc.getElementsByTagName('a:majorFont')[0];
		const minor = doc.getElementsByTagName('a:minorFont')[0];
		fonts = { major: attr(major && major.getElementsByTagName('a:latin')[0], 'typeface', ''), minor: attr(minor && minor.getElementsByTagName('a:latin')[0], 'typeface', '') };
	}
	return { colors, fonts };
}

const CLRMAP = { tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' }; // the usual mapping; a master's own <p:clrMap> (dark decks) overrides it
/** The colour inside a fill-like element (solidFill, a gradient stop, ...), as hex; null when there is none. */
function colorIn(el, theme) {
	const c = el && [...el.children].find((k) => ['a:srgbClr', 'a:schemeClr', 'a:sysClr', 'a:prstClr'].includes(k.nodeName));
	if (!c) return null;
	let base;
	if (c.nodeName === 'a:srgbClr') base = hex(attr(c, 'val', '000000'));
	else if (c.nodeName === 'a:sysClr') base = hex(attr(c, 'lastClr', '000000'));
	else if (c.nodeName === 'a:prstClr') base = attr(c, 'val') === 'white' ? '#ffffff' : '#000000';
	else {
		const key = attr(c, 'val', 'tx1');
		const mapped = (theme.clrMap && theme.clrMap[key]) || CLRMAP[key] || key;
		base = theme.colors[mapped] || theme.colors[key] || '#000000';
	}
	const mod = (name) => {
		const m = kid(c, name);
		return m ? num(m, 'val') / 100000 : null;
	};
	const lumMod = mod('a:lumMod');
	const lumOff = mod('a:lumOff');
	if (lumMod !== null || lumOff !== null) {
		const [h, s, l] = hslOf(base);
		base = hexOf([h, s, clamp(l * (lumMod ?? 1) + (lumOff ?? 0), 0, 1)]);
	}
	return base;
}

// ---- geometry ---------------------------------------------------------------------------------------------

function makeMapper(cx, cy) {
	const k = Math.min(CANVAS_W / cx, CANVAS_H / cy);
	const ox = (CANVAS_W - cx * k) / 2;
	const oy = (CANVAS_H - cy * k) / 2;
	return { k, box: (x, y, w, h) => ({ x: Math.round(ox + x * k), y: Math.round(oy + y * k), w: Math.max(4, Math.round(w * k)), h: Math.max(2, Math.round(h * k)) }), pt: (pt) => Math.round(pt * EMU_PT * k) };
}

function xfrmOf(spPr) {
	const x = kid(spPr, 'a:xfrm');
	if (!x) return null;
	const off = kid(x, 'a:off');
	const ext = kid(x, 'a:ext');
	if (!off || !ext) return null;
	return { x: num(off, 'x'), y: num(off, 'y'), w: num(ext, 'cx'), h: num(ext, 'cy'), rot: num(x, 'rot') / 60000, flipH: attr(x, 'flipH') === '1' };
}

/** Placeholder positions from a layout or master, so a slide's title box finds its place when the slide itself carries none. */
function placeholdersOf(doc) {
	const out = [];
	if (!doc) return out;
	descendants(doc, 'p:sp').forEach((sp) => {
		const ph = sp.getElementsByTagName('p:ph')[0];
		const x = xfrmOf(kid(sp, 'p:spPr'));
		if (ph && x) out.push({ type: attr(ph, 'type', 'body'), idx: attr(ph, 'idx'), ...x });
	});
	return out;
}
const lookupPlaceholder = (list, type, idx) => list.find((p) => (idx !== undefined && p.idx === idx) || (idx === undefined && p.type === type)) || list.find((p) => p.type === type) || null;

// ---- text -------------------------------------------------------------------------------------------------

const FAMILY = (face) => (/georgia|times|garamond|palatino|serif|cambria|book/i.test(face || '') && !/sans/i.test(face || '') ? 'serif' : /courier|consolas|mono|menlo/i.test(face || '') ? 'mono' : 'default');

function textOf(sp, theme, map, role) {
	const body = kid(sp, 'p:txBody');
	if (!body) return null;
	const paras = kids(body, 'a:p');
	const lines = paras.map((p) =>
		[...p.children]
			.filter((c) => c.nodeName === 'a:r' || c.nodeName === 'a:br' || c.nodeName === 'a:fld')
			.map((c) => (c.nodeName === 'a:br' ? '\n' : ((kid(c, 'a:t') || {}).textContent || '')))
			.join('')
	);
	const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
	if (!text) return null;
	const firstRun = descendants(body, 'a:rPr').find((r) => r.parentNode.nodeName === 'a:r') || descendants(body, 'a:endParaRPr')[0] || null;
	const defRPr = descendants(body, 'a:defRPr')[0] || null;
	const rPr = firstRun || defRPr;
	const sz = rPr && attr(rPr, 'sz') ? Number(attr(rPr, 'sz')) / 100 : DEFAULT_PT[role] || 18;
	const pPr = descendants(body, 'a:pPr')[0];
	const algn = attr(pPr, 'algn', 'l');
	const anchor = attr(kid(body, 'a:bodyPr'), 'anchor', role === 'title' || role === 'ctrTitle' ? 'ctr' : 't');
	const color = (rPr && colorIn(kid(rPr, 'a:solidFill'), theme)) || theme.colors[(theme.clrMap && theme.clrMap.tx1) || 'dk1'] || null; // no colour on the run: the deck's own text colour
	const face = (rPr && attr(kid(rPr, 'a:latin'), 'typeface')) || '';
	const themeFace = face.startsWith('+mj') ? theme.fonts.major : face.startsWith('+mn') || !face ? theme.fonts.minor : face;
	return {
		text,
		st: {
			fs: clamp(map.pt(sz), 10, 400),
			fw: rPr && attr(rPr, 'b') === '1' ? 700 : role === 'title' || role === 'ctrTitle' ? 600 : 400,
			...(rPr && attr(rPr, 'i') === '1' ? { it: true } : {}),
			...(rPr && attr(rPr, 'u') && attr(rPr, 'u') !== 'none' ? { ul: true } : {}),
			al: algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : 'left',
			va: anchor === 'ctr' ? 'middle' : anchor === 'b' ? 'bottom' : 'top',
			ff: FAMILY(themeFace),
			lh: 1.15,
			...(color ? { color } : {}),
		},
	};
}

// ---- shapes -----------------------------------------------------------------------------------------------

const SHAPE_OF = { rect: 'rect', roundRect: 'rect', round2SameRect: 'rect', ellipse: 'ellipse', triangle: 'triangle', rtTriangle: 'triangle', line: 'line', straightConnector1: 'line' };

function fillOf(spPr, theme) {
	if (!spPr) return { fill: null, none: false };
	if (kid(spPr, 'a:noFill')) return { fill: null, none: true };
	const solid = kid(spPr, 'a:solidFill');
	if (solid) return { fill: colorIn(solid, theme), none: false };
	const grad = kid(spPr, 'a:gradFill');
	if (grad) {
		const stops = descendants(grad, 'a:gs').map((g) => colorIn(g, theme)).filter(Boolean);
		return { fill: stops[0] || null, fill2: stops.length > 1 ? stops[stops.length - 1] : null, none: false };
	}
	return { fill: null, none: false };
}

/** Everything one shape or picture contributes: zero, one or two objects (a filled text box is a shape plus text). */
async function objectsOf(node, ctx) {
	const made = await objectsOfInner(node, ctx);
	const cnv = node.getElementsByTagName('p:cNvPr')[0];
	const spid = cnv ? attr(cnv, 'id') : null;
	return spid ? made.map((o) => ({ ...o, _spid: spid })) : made;
}

async function objectsOfInner(node, ctx) {
	const { theme, map, layoutPh, masterPh, rels, files, report } = ctx;
	const name = node.nodeName;
	if (name === 'p:graphicFrame') {
		report.skipped += 1;
		return [];
	}
	const isPic = name === 'p:pic';
	const isConn = name === 'p:cxnSp';
	const spPr = kid(node, 'p:spPr');
	const phEl = node.getElementsByTagName('p:ph')[0];
	const phType = phEl ? attr(phEl, 'type', 'body') : null;
	const phIdx = phEl ? attr(phEl, 'idx') : undefined;
	if (phType && SKIP_PLACEHOLDERS.has(phType)) return [];
	let x = xfrmOf(spPr);
	if (!x && phEl) x = lookupPlaceholder(layoutPh, phType, phIdx) || lookupPlaceholder(masterPh, phType, phIdx);
	if (!x) return [];
	const box = map.box(x.x, x.y, x.w, x.h);
	const rot = x.rot ? { rot: Math.round(x.rot) } : {};

	if (isPic) {
		const embed = attr(node.getElementsByTagName('a:blip')[0], 'r:embed');
		const target = embed && rels[embed];
		const alt = attr(kid(kid(node, 'p:nvPicPr'), 'p:cNvPr'), 'descr', '') || 'Picture';
		let src = '';
		if (target && files[target]) {
			try {
				src = await shrinkBlob(new Blob([files[target]], { type: /\.png$/i.test(target) ? 'image/png' : /\.jpe?g$/i.test(target) ? 'image/jpeg' : /\.gif$/i.test(target) ? 'image/gif' : 'image/webp' }));
			} catch {
				report.pictures += 1; // too detailed to store: the box stays, ready for a link
			}
		}
		return [makeImage({ ...box, ...rot, src, alt, fit: 'cover', st: { r: 0 } })];
	}

	const { fill, fill2, none } = fillOf(spPr, theme);
	const ln = kid(spPr, 'a:ln');
	const lnFill = ln && !kid(ln, 'a:noFill') ? colorIn(kid(ln, 'a:solidFill'), theme) : null;
	const lnW = ln ? Math.max(1, Math.round(map.pt((num(ln, 'w') / EMU_PT) || 1))) : 0;
	const geom = attr(kid(spPr, 'a:prstGeom'), 'prst', 'rect');
	const shapeType = isConn ? 'line' : SHAPE_OF[geom] || 'rect';
	const role = phType;
	const t = textOf(node, theme, map, role);
	const out = [];

	const drawsShape = !phType && (isConn || fill || lnFill || (fill2 && !none));
	if (drawsShape) {
		const line = shapeType === 'line';
		out.push(
			makeShape({
				...box,
				...rot,
				shape: shapeType,
				h: line ? Math.max(2, Math.min(box.h, 12)) : box.h,
				st: { fill: line ? lnFill || fill || '#888888' : fill || 'transparent', ...(fill2 ? { fill2 } : {}), op: 1, r: geom === 'roundRect' ? Math.round(Math.min(box.w, box.h) * 0.12) : 0, ...(lnFill && !line ? { bc: lnFill, bw: Math.min(lnW, 24) } : {}) },
			})
		);
	}
	// text inside a drawn shape sits inside it (PowerPoint's own text inset), not on its edge
	const inset = drawsShape && shapeType !== 'line' ? { x: box.x + 16, y: box.y + 10, w: Math.max(8, box.w - 32), h: Math.max(8, box.h - 20) } : box;
	if (t) out.push(makeText({ ...inset, ...rot, text: t.text, st: { color: '#222222', ...t.st }, ...(role === 'title' || role === 'ctrTitle' ? { name: 'title' } : {}) }));
	return out;
}

async function walk(tree, ctx, offsetMap = null) {
	const out = [];
	for (const node of [...tree.children]) {
		if (node.nodeName === 'p:grpSp') {
			const gp = kid(node, 'p:grpSpPr');
			const gx = kid(gp, 'a:xfrm');
			// Child shapes live in the group's own coordinate space: map it onto the group's box on the slide.
			let inner = ctx;
			if (gx) {
				const off = kid(gx, 'a:off');
				const ext = kid(gx, 'a:ext');
				const choff = kid(gx, 'a:chOff');
				const chext = kid(gx, 'a:chExt');
				if (off && ext && choff && chext && num(chext, 'cx') && num(chext, 'cy')) {
					const sx = num(ext, 'cx') / num(chext, 'cx');
					const sy = num(ext, 'cy') / num(chext, 'cy');
					inner = { ...ctx, map: { ...ctx.map, box: (x, y, w, h) => ctx.map.box(num(off, 'x') + (x - num(choff, 'x')) * sx, num(off, 'y') + (y - num(choff, 'y')) * sy, w * sx, h * sy) } };
				}
			}
			out.push(...(await walk(node, inner, offsetMap)));
		} else if (['p:sp', 'p:pic', 'p:cxnSp', 'p:graphicFrame'].includes(node.nodeName)) {
			out.push(...(await objectsOf(node, ctx)));
		}
	}
	return out;
}

// ---- the file ---------------------------------------------------------------------------------------------

const relsOf = (xml) => {
	const out = {};
	if (!xml) return out;
	descendants(parse(xml), 'Relationship').forEach((r) => {
		out[attr(r, 'Id')] = { target: attr(r, 'Target', ''), type: attr(r, 'Type', '') };
	});
	return out;
};
const resolve = (base, target) => {
	if (target.startsWith('/')) return target.slice(1);
	const parts = base.split('/').slice(0, -1);
	target.split('/').forEach((seg) => {
		if (seg === '..') parts.pop();
		else if (seg !== '.') parts.push(seg);
	});
	return parts.join('/');
};

function backgroundOf(slideDoc, layoutDoc, masterDoc, theme) {
	for (const doc of [slideDoc, layoutDoc, masterDoc]) {
		const bg = doc && doc.getElementsByTagName('p:bg')[0];
		if (!bg) continue;
		const pr = kid(bg, 'p:bgPr');
		if (pr) {
			const solid = kid(pr, 'a:solidFill');
			if (solid) return { kind: 'solid', color: colorIn(solid, theme) || '#ffffff' };
			const grad = kid(pr, 'a:gradFill');
			if (grad) {
				const stops = descendants(grad, 'a:gs').map((g) => colorIn(g, theme)).filter(Boolean);
				if (stops.length > 1) return { kind: 'gradient', color: stops[0], color2: stops[stops.length - 1], angle: Math.round(num(kid(grad, 'a:lin'), 'ang', 5400000) / 60000) };
				if (stops.length === 1) return { kind: 'solid', color: stops[0] };
			}
		}
		const ref = kid(bg, 'p:bgRef');
		if (ref) {
			const c = colorIn(ref, theme);
			if (c) return { kind: 'solid', color: c };
		}
	}
	return { kind: 'solid', color: theme.colors[(theme.clrMap && theme.clrMap.bg1) || 'lt1'] || '#ffffff' };
}

// ---- animations: the entrance effects of the slide's timing tree ----------------------------------------------

/** PowerPoint preset ids (entrance class) -> the studio's entrance animations. */
function presetToAnim(id, sub) {
	if (id === 2) return sub === 8 ? 'left' : sub === 2 ? 'right' : 'rise'; // fly in
	if (id === 53 || id === 3 || id === 21) return 'zoom'; // grow and turn, zoom, ...
	if (id === 22 || id === 5 || id === 16) return 'type'; // wipe, ...
	return 'fade'; // appear, fade and anything else
}

/** Map of shape id -> { in, step, delay, dur } for the entrance effects, counting "on click" groups in order. */
function animationsOf(doc) {
	const out = new Map();
	let step = 0;
	descendants(doc, 'p:cTn')
		.filter((n) => attr(n, 'presetClass') === 'entr')
		.forEach((n) => {
			const type = attr(n, 'nodeType');
			if (type === 'clickEffect') step += 1;
			const tgt = n.getElementsByTagName('p:spTgt')[0];
			if (!tgt) return;
			out.set(attr(tgt, 'spid'), { in: presetToAnim(num(n, 'presetID'), num(n, 'presetSubtype')), step: Math.min(step, 8), delay: type === 'afterEffect' ? 400 : 0, dur: 600 });
		});
	return out;
}

/** @returns {Promise<{ title: string, slides: object[], report: { skipped: number, pictures: number, truncated: number } }>} */
export async function importPptx(file) {
	if (!/\.pptx$/i.test(file.name)) throw new Error('Choose a PowerPoint file ending in .pptx (older .ppt files are not supported).');
	if (file.size > MAX_BYTES) throw new Error('That file is larger than 40 MB.');
	const { unzipSync, strFromU8 } = await import('fflate');
	let files;
	const bytes = new Uint8Array(await readBuffer(file));
	try {
		files = unzipSync(bytes, { filter: (f) => /^ppt\/(presentation\.xml|_rels\/presentation\.xml\.rels|slides\/|slideLayouts\/|slideMasters\/|theme\/|media\/)/.test(f.name) && f.originalSize < 12 * 1024 * 1024 });
	} catch {
		throw new Error('That file is not a readable PowerPoint presentation.');
	}
	const text = (path) => (files[path] ? strFromU8(files[path]) : null);
	const presXml = text('ppt/presentation.xml');
	if (!presXml) throw new Error('That file does not look like a PowerPoint presentation (no slides found).');
	const pres = parse(presXml);
	if (isError(pres)) throw new Error('The presentation could not be read.');
	const sz = pres.getElementsByTagName('p:sldSz')[0];
	const map = makeMapper(num(sz, 'cx', 12192000), num(sz, 'cy', 6858000));

	const presRels = relsOf(text('ppt/_rels/presentation.xml.rels'));
	const order = descendants(pres, 'p:sldId').map((s) => presRels[attr(s, 'r:id')]).filter(Boolean).map((r) => resolve('ppt/presentation.xml', r.target));
	if (!order.length) throw new Error('That presentation has no slides.');

	const baseTheme = parseTheme(text('ppt/theme/theme1.xml'));
	const report = { skipped: 0, pictures: 0, truncated: 0, animations: 0, clicks: 0, layouts: {}, palette: [], fonts: { heading: baseTheme.fonts.major, body: baseTheme.fonts.minor } };
	report.palette = [...new Set(['dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'].map((k) => baseTheme.colors[k]).filter(Boolean))];
	const slides = [];
	let title = '';
	for (const path of order.slice(0, 50)) {
		const xml = text(path);
		if (!xml) continue;
		const doc = parse(xml);
		const rels = relsOf(text(path.replace('slides/', 'slides/_rels/') + '.rels'));
		const layoutRel = Object.values(rels).find((r) => /slideLayout$/.test(r.type));
		const layoutPath = layoutRel ? resolve(path, layoutRel.target) : null;
		const layoutDoc = layoutPath && text(layoutPath) ? parse(text(layoutPath)) : null;
		const layoutRels = layoutPath ? relsOf(text(layoutPath.replace('slideLayouts/', 'slideLayouts/_rels/') + '.rels')) : {};
		const masterRel = Object.values(layoutRels).find((r) => /slideMaster$/.test(r.type));
		const masterPath = masterRel ? resolve(layoutPath, masterRel.target) : null;
		const masterDoc = masterPath && text(masterPath) ? parse(text(masterPath)) : null;
		const clr = masterDoc && masterDoc.getElementsByTagName('p:clrMap')[0];
		const theme = { ...baseTheme, clrMap: clr ? Object.fromEntries([...clr.attributes].map((a) => [a.name, a.value])) : null };
		const media = {};
		Object.entries(rels).forEach(([id, r]) => {
			if (/image$/.test(r.type)) {
				const p = resolve(path, r.target);
				if (files[p]) media[id] = p;
			}
		});
		const ctx = { theme, map, layoutPh: placeholdersOf(layoutDoc), masterPh: placeholdersOf(masterDoc), rels: media, files, report };
		const tree = doc.getElementsByTagName('p:spTree')[0];
		let objects = tree ? await walk(tree, ctx) : [];
		if (objects.length > MAX_OBJECTS) {
			report.truncated += objects.length - MAX_OBJECTS;
			objects = objects.slice(0, MAX_OBJECTS);
		}
		// entrance animations the author set up in PowerPoint become the same animations here (and "on click" steps)
		const layoutName = layoutDoc ? attr(layoutDoc.getElementsByTagName('p:cSld')[0], 'name', '') : '';
		if (layoutName) report.layouts[layoutName] = (report.layouts[layoutName] || 0) + 1;
		const anims = animationsOf(doc);
		objects = objects.map((o) => {
			const a = o._spid && anims.get(o._spid);
			return a ? { ...o, anim: a } : o;
		});
		report.animations += objects.filter((o) => o.anim).length;
		report.clicks = Math.max(report.clicks, ...objects.map((o) => (o.anim ? o.anim.step : 0)), 0);
		const slideTitle = (objects.find((o) => o.name === 'title') || {}).text;
		if (!title && slideTitle) title = slideTitle.split('\n')[0].slice(0, 120);
objects = objects.map(({ name: _n, _spid, ...o }) => ({ ...o, id: uid() }));
		slides.push(makeSlide({ name: slideTitle ? slideTitle.split('\n')[0].slice(0, 80) : '', bg: backgroundOf(doc, layoutDoc, masterDoc, theme), objects }));
	}
	if (!slides.length) throw new Error('No slides could be read from that file.');
	return { title: title || file.name.replace(/\.pptx$/i, ''), slides, report };
}
