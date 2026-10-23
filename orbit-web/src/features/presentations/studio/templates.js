import { makeShape, makeSlide, makeText, makeWidget, makeButton, uid } from './slideModel';

/**
 * Starting designs for the studio. Each is a complete little deck (cover, numbers, ranked bars, people, trend, closing)
 * built from the same objects the editor offers, so everything on it can be edited, moved, replaced or deleted. They are
 * deliberately plain and different from each other: flat colour fields, hairlines and large type, with no glow, orbs, dot
 * grids or gradients. Colours are fixed hex values, so a design looks the same whatever theme the viewer prefers.
 */

const T = (text, x, y, w, h, st = {}, extra = {}) => makeText({ text, x, y, w, h, st, ...extra });
const R = (x, y, w, h, fill, extra = {}) => makeShape({ ...extra, x, y, w, h, st: { fill, op: 1, ...(extra.st || {}) } });
const anim = (kind, delay = 0, step = 0) => ({ anim: { in: kind, delay, dur: 650, step } });
const W = (type, metric, x, y, w, h, st, extra = {}) => makeWidget(type, { x, y, w, h, widget: { type, metric, top: 5, compare: type === 'kpi' }, st, ...extra });

const STYLES = [
	{
		id: 'boardroom',
		name: 'Boardroom',
		description: 'Near-black, off-white type and one amber accent',
		bg: '#0f131a',
		ink: '#f4f5f7',
		muted: '#98a2b3',
		accent: '#e8a33d',
		card: '#181e28',
		ff: 'default',
		fw: 700,
		r: 22,
		decor: (n) => [R(0, 0, 18, 1080, '#e8a33d'), ...(n ? [R(160, 96, 120, 6, '#e8a33d')] : [])],
		coverExtra: (c) => [R(1480, 0, 440, 1080, c.card), T('2026', 1510, 840, 400, 190, { fs: 150, fw: 800, color: '#262f3d', al: 'left' })],
	},
	{
		id: 'paper',
		name: 'Paper',
		description: 'Warm paper, serif headlines and thin rules',
		bg: '#f6f1e7',
		ink: '#1d1b16',
		muted: '#6b6558',
		accent: '#b3412e',
		card: '#ece4d3',
		ff: 'serif',
		fw: 700,
		r: 4,
		decor: (n) => [R(160, 118, 1600, 3, '#1d1b16'), ...(n ? [] : [])],
		coverExtra: () => [R(160, 118, 1600, 3, '#1d1b16'), R(160, 940, 1600, 3, '#1d1b16'), R(160, 926, 22, 22, '#b3412e')],
	},
	{
		id: 'blueprint',
		name: 'Blueprint',
		description: 'White page, navy block and a clear blue',
		bg: '#ffffff',
		ink: '#12263f',
		muted: '#5b6f89',
		accent: '#1f6feb',
		card: '#eef4ff',
		ff: 'default',
		fw: 700,
		r: 16,
		decor: () => [R(0, 0, 1920, 14, '#12263f')],
		coverExtra: (c) => [R(0, 0, 700, 1080, '#12263f'), R(700, 0, 24, 1080, c.accent)],
		coverLeftText: true,
	},
	{
		id: 'slate',
		name: 'Slate',
		description: 'Cool grey cards with a teal accent',
		bg: '#1b2430',
		ink: '#eef2f6',
		muted: '#9aa8b8',
		accent: '#2dd4bf',
		card: '#26364a',
		titleW: 960,
		ff: 'default',
		fw: 600,
		r: 36,
		decor: () => [],
		coverExtra: (c) => [R(1180, 140, 560, 800, c.card, { st: { r: 48 } }), R(1250, 220, 160, 160, c.accent, { shape: 'ellipse' })],
	},
	{
		id: 'sunrise',
		name: 'Sunrise',
		description: 'Cream, burnt orange and soft rounded cards',
		bg: '#fff7ed',
		ink: '#3b1d0c',
		muted: '#8a5a3c',
		accent: '#ea580c',
		card: '#ffe8d1',
		titleW: 980,
		ff: 'rounded',
		fw: 700,
		r: 44,
		decor: () => [R(1640, -120, 420, 420, '#ea580c', { shape: 'ellipse' })],
		coverExtra: (c) => [R(1180, 300, 900, 900, c.accent, { shape: 'ellipse' }), R(1020, 640, 280, 280, '#ffd2a8', { shape: 'ellipse' })],
	},
	{
		id: 'mono',
		name: 'Mono',
		description: 'High-contrast black and white, huge type',
		bg: '#ffffff',
		ink: '#0a0a0a',
		muted: '#555555',
		accent: '#0a0a0a',
		card: '#f1f1f1',
		ff: 'default',
		fw: 800,
		r: 0,
		decor: () => [R(160, 90, 1600, 8, '#0a0a0a')],
		coverExtra: () => [R(0, 780, 1920, 300, '#0a0a0a')],
		coverInvert: true,
	},
];

const kicker = (c, text, y = 148) => T(text.toUpperCase(), 160, y, 900, 44, { fs: 26, fw: 700, color: c.accent === '#0a0a0a' ? c.muted : c.accent, ls: 4 });
const headline = (c, text, y = 186, fs = 76) => T(text, 160, y, 1500, 130, { fs, fw: c.fw, color: c.ink, ff: c.ff, lh: 1.08, ls: c.id === 'mono' ? -2 : 0 }, anim('rise'));
const card = (c, x, y, w, h) => R(x, y, w, h, c.card, { st: { r: c.r } });
const cardSt = (c) => ({ color: c.ink, fill: c.card, fill2: c.accent, r: c.r });
const plainSt = (c) => ({ color: c.ink, fill: 'transparent', fill2: c.accent, r: 0 });

function coverSlide(c) {
	const light = c.coverInvert;
	const objects = [...c.coverExtra(c)];
	if (c.coverLeftText) {
		objects.push(T('QUARTERLY REVIEW', 90, 140, 560, 44, { fs: 24, fw: 700, color: '#8fb4ff', ls: 4 }), T('Meeting 360', 90, 900, 560, 60, { fs: 36, fw: 600, color: '#ffffff' }));
		objects.push(T('Delivery and people, Q3', 800, 360, 1000, 300, { fs: 112, fw: c.fw, color: c.ink, lh: 1.02 }, anim('rise')), T('Presented to the leadership team', 800, 700, 1000, 60, { fs: 38, fw: 400, color: c.muted }, anim('rise', 150)));
	} else if (light) {
		objects.push(T('Delivery and people, Q3', 160, 130, 1500, 460, { fs: 210, fw: c.fw, color: c.ink, lh: 0.96, ls: -6 }, anim('rise')), T('Quarterly review for the leadership team', 160, 840, 1300, 70, { fs: 44, fw: 500, color: '#ffffff' }, anim('rise', 200)));
	} else {
		objects.push(kicker(c, 'Quarterly review', 230), T('Delivery and people, Q3', 160, 300, c.titleW || 1200, 330, { fs: 120, fw: c.fw, color: c.ink, ff: c.ff, lh: 1.02 }, anim('rise')), T('Presented to the leadership team', 160, 690, 1100, 60, { fs: 38, fw: 400, color: c.muted, ff: c.ff }, anim('rise', 150)));
	}
	return makeSlide({ name: 'Cover', bg: { kind: 'solid', color: c.bg }, objects });
}

function numbersSlide(c) {
	const st = cardSt(c);
	return makeSlide({
		name: 'Numbers',
		bg: { kind: 'solid', color: c.bg },
		objects: [
			...c.decor(1),
			kicker(c, 'This period'),
			headline(c, 'The period in three numbers'),
			W('kpi', 'billable_hours', 160, 400, 520, 440, st, anim('rise', 100, 0)),
			W('kpi', 'headcount', 700, 400, 520, 440, st, anim('rise', 220, 1)),
			W('kpi', 'late_rate', 1240, 400, 520, 440, st, anim('rise', 340, 2)),
			T('Click or press → to reveal each number. Replace this line with what the numbers mean.', 160, 900, 1500, 50, { fs: 28, fw: 400, color: c.muted, ff: c.ff }),
		],
	});
}

function barsSlide(c) {
	return makeSlide({
		name: 'Where the time went',
		bg: { kind: 'solid', color: c.bg },
		objects: [
			...c.decor(1),
			kicker(c, 'Delivery'),
			headline(c, 'Where the time went'),
			W('bars', 'workload', 160, 330, 1060, 620, plainSt(c), { hover: 'none' }),
			card(c, 1300, 330, 460, 620),
			T('Our read', 1340, 366, 380, 50, { fs: 30, fw: 700, color: c.accent === '#0a0a0a' ? c.ink : c.accent, ff: c.ff }),
			T('Write the one thing you want the room to take from this chart. Keep it to a sentence or two.', 1340, 430, 380, 480, { fs: 34, fw: 400, color: c.ink, ff: c.ff, lh: 1.3 }, anim('fade', 500)),
		],
	});
}

function peopleSlide(c) {
	return makeSlide({
		name: 'People',
		bg: { kind: 'solid', color: c.bg },
		objects: [
			...c.decor(1),
			kicker(c, 'People'),
			headline(c, 'Who carried the period'),
			W('leaders', 'top_performers', 160, 330, 780, 640, cardSt(c), anim('left', 100)),
			W('leaders', 'best_attendance', 980, 330, 780, 640, cardSt(c), anim('right', 100)),
		],
	});
}

function trendSlide(c) {
	return makeSlide({
		name: 'Trend',
		bg: { kind: 'solid', color: c.bg },
		objects: [
			...c.decor(1),
			kicker(c, 'Trend'),
			headline(c, 'How billable hours moved'),
			W('trend', 'billable_hours', 160, 330, 1180, 620, cardSt(c), anim('fade', 100)),
			W('donut', 'billable_share', 1380, 330, 380, 620, cardSt(c), anim('zoom', 300, 1)),
		],
	});
}

function closingSlide(c) {
	return makeSlide({
		name: 'Closing',
		bg: { kind: 'solid', color: c.coverInvert ? '#0a0a0a' : c.bg },
		objects: [
			...(c.coverInvert ? [] : c.decor(0)),
			T('Thank you', 160, 330, 1500, 260, { fs: 200, fw: c.fw, color: c.coverInvert ? '#ffffff' : c.ink, ff: c.ff, lh: 1, ls: c.id === 'mono' ? -6 : 0 }, anim('rise')),
			T('Questions and discussion', 160, 640, 1200, 60, { fs: 40, fw: 400, color: c.coverInvert ? '#bbbbbb' : c.muted, ff: c.ff }),
			makeButton({ text: 'Open the full report', x: 160, y: 780, w: 420, h: 96, link: '', st: { fs: 32, fw: 600, color: c.coverInvert ? '#0a0a0a' : c.bg, fill: c.coverInvert ? '#ffffff' : c.accent, r: c.r > 30 ? 999 : c.r, al: 'center' }, hover: 'lift' }),
		],
	});
}

/** The deck for one design (fresh ids every time). */
export function deckFromTemplate(id) {
	const c = STYLES.find((s) => s.id === id) || STYLES[0];
	return [coverSlide(c), numbersSlide(c), barsSlide(c), peopleSlide(c), trendSlide(c), closingSlide(c)];
}

export const BLANK_DECK = () => [makeSlide({ name: 'Title', bg: { kind: 'theme' }, objects: [makeText({ text: 'Your title', x: 160, y: 380, w: 1500, h: 200, st: { fs: 120, fw: 700, color: 'theme:text', lh: 1.05 }, anim: { in: 'rise', delay: 0, dur: 650, step: 0 } })] })];

export const TEMPLATE_LIST = STYLES.map((s) => ({ id: s.id, name: s.name, description: s.description, bg: s.bg, ink: s.ink, accent: s.accent, card: s.card }));

export { uid };
