import React, { useMemo } from 'react';

/**
 * The sign-in artwork: dark tropical foliage seen through layered paper-cut edges (after UI_Design/b4492ab0...jpg).
 * Everything is drawn here as SVG from a seeded generator, so it is identical on every load, needs no image file, and
 * stays crisp at any size. It carries no data and is hidden from assistive technology by its parent.
 */

// small deterministic random numbers (the same art every time)
function rng(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const f1 = (n) => Math.round(n * 10) / 10;

/** One palm frond growing from (x, y) at `angle` degrees (0 = straight up): a curved stem with a leaflet pair at every step. */
function frondPath(x, y, angle, len, rand, { leaflets = 22, spread = 0.34, bend = 0.25 } = {}) {
	const a = ((angle - 90) * Math.PI) / 180;
	const dir = (t) => a + bend * t * t; // the stem curls as it grows
	let px = x;
	let py = y;
	let d = '';
	const step = len / leaflets;
	for (let i = 1; i <= leaflets; i += 1) {
		const t = i / leaflets;
		const th = dir(t);
		px += Math.cos(th) * step;
		py += Math.sin(th) * step;
		const l = len * spread * Math.pow(Math.sin(Math.PI * Math.min(0.96, t * 0.9 + 0.08)), 0.7) * (1 - t * 0.45) * (0.85 + rand() * 0.3);
		const w = l * (0.13 + rand() * 0.05);
		for (const side of [-1, 1]) {
			const lt = th + side * (0.95 - t * 0.35 + (rand() - 0.5) * 0.18);
			const tipx = px + Math.cos(lt) * l;
			const tipy = py + Math.sin(lt) * l;
			const mx = px + Math.cos(lt) * l * 0.5;
			const my = py + Math.sin(lt) * l * 0.5;
			const nx = -Math.sin(lt) * w;
			const ny = Math.cos(lt) * w;
			d += `M${f1(px)} ${f1(py)}Q${f1(mx + nx)} ${f1(my + ny)} ${f1(tipx)} ${f1(tipy)}Q${f1(mx - nx)} ${f1(my - ny)} ${f1(px)} ${f1(py)}Z`;
		}
	}
	return d;
}

/** A smooth closed edge: Catmull-Rom through the points, then down the left side. Used for each paper sheet. */
function wavePath(points, left, bottom) {
	let d = `M${left} ${points[0][1]}L${f1(points[0][0])} ${f1(points[0][1])}`;
	for (let i = 0; i < points.length - 1; i += 1) {
		const p0 = points[Math.max(0, i - 1)];
		const p1 = points[i];
		const p2 = points[i + 1];
		const p3 = points[Math.min(points.length - 1, i + 2)];
		const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
		const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
		d += `C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(p2[0])} ${f1(p2[1])}`;
	}
	return `${d}L${left} ${bottom}Z`;
}

/** The sweeping S-shaped edge of the paper, top to bottom, shifted right for each deeper sheet. */
const EDGE = [
	[96, -10],
	[104, 60],
	[142, 130],
	[170, 210],
	[150, 290],
	[116, 360],
	[104, 430],
	[130, 500],
	[176, 560],
	[170, 640],
	[128, 720],
];

const SHEETS = [
	{ dx: 74, dy: 0, fill: '#aeb5af' },
	{ dx: 52, dy: 6, fill: '#c6ccc7' },
	{ dx: 32, dy: 10, fill: '#dfe3df' },
	{ dx: 15, dy: 14, fill: '#eef0ed' },
	{ dx: 0, dy: 0, fill: '#fcfcfb' },
];

export default function LoginBotanical() {
	const art = useMemo(() => {
		const rand = rng(360);
		const layer = (specs, opts) => specs.map(([x, y, angle, len]) => frondPath(x, y, angle, len, rand, opts));
		return {
			back: layer(
				[
					[430, 760, -8, 560],
					[560, 780, 14, 540],
					[330, 740, -26, 480],
					[620, 560, 52, 460],
					[620, 300, 74, 420],
					[470, 740, -40, 520],
				],
				{ leaflets: 20, spread: 0.3 }
			),
			mid: layer(
				[
					[400, 790, -34, 500],
					[520, 800, -4, 600],
					[640, 770, 26, 520],
					[300, 700, -52, 420],
					[620, 520, 60, 440],
					[620, 250, 84, 400],
					[560, 800, -18, 560],
					[250, 760, -70, 380],
				],
				{ leaflets: 24, spread: 0.36 }
			),
			front: layer(
				[
					[250, 700, -64, 400],
					[360, 800, -22, 480],
					[470, 820, 6, 440],
					[580, 760, 40, 420],
					[200, 520, -78, 300],
					[620, 420, 70, 380],
					[330, 780, -44, 440],
					[600, 640, 58, 360],
				],
				{ leaflets: 22, spread: 0.42, bend: 0.4 }
			),
			sheets: SHEETS.map((s) => wavePath(EDGE.map(([x, y]) => [x + s.dx, y + s.dy]), -20, 730)),
		};
	}, []);

	return (
		<svg className="login-botanical" viewBox="0 0 620 720" preserveAspectRatio="xMinYMid slice" role="presentation" aria-hidden="true" focusable="false">
			<defs>
				<linearGradient id="lb-deep" x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stopColor="#173325" />
					<stop offset="0.6" stopColor="#22442f" />
					<stop offset="1" stopColor="#2d5640" />
				</linearGradient>
				<filter id="lb-soft" x="-10%" y="-10%" width="120%" height="120%">
					<feGaussianBlur stdDeviation="2.2" />
				</filter>
				<filter id="lb-paper" x="-20%" y="-5%" width="140%" height="110%">
					<feDropShadow dx="-7" dy="5" stdDeviation="6" floodColor="#10201a" floodOpacity="0.38" />
				</filter>
				<filter id="lb-fronds" x="-10%" y="-10%" width="120%" height="120%">
					<feDropShadow dx="-3" dy="5" stdDeviation="4" floodColor="#06120c" floodOpacity="0.55" />
				</filter>
			</defs>
			<rect width="620" height="720" fill="url(#lb-deep)" />
			<g className="login-botanical__back" fill="#1d3a2b" filter="url(#lb-soft)">
				{art.back.map((d, i) => (
					<path key={i} d={d} />
				))}
			</g>
			<g className="login-botanical__mid" fill="#2c5a42" filter="url(#lb-fronds)">
				{art.mid.map((d, i) => (
					<path key={i} d={d} />
				))}
			</g>
			<g className="login-botanical__front" fill="#3f7556" filter="url(#lb-fronds)">
				{art.front.map((d, i) => (
					<path key={i} d={d} />
				))}
			</g>
			{/* paper sheets, deepest first; the last one is the card's own surface, so the form side flows into the wave */}
			{art.sheets.map((d, i) => (
				<path key={i} className="login-botanical__sheet" style={{ '--i': i }} d={d} fill={SHEETS[i].fill} filter="url(#lb-paper)" />
			))}
		</svg>
	);
}

/** Soft, out-of-focus fronds in the page corners behind the card. */
export function LoginBackdrop() {
	const paths = useMemo(() => {
		const rand = rng(77);
		return [
			frondPath(-20, 520, 30, 520, rand, { leaflets: 20, spread: 0.34 }),
			frondPath(120, 880, 8, 560, rand, { leaflets: 22, spread: 0.32 }),
			frondPath(1000, 880, -22, 600, rand, { leaflets: 22, spread: 0.34 }),
			frondPath(1240, 640, -52, 520, rand, { leaflets: 20, spread: 0.36 }),
			frondPath(380, -40, 176, 380, rand, { leaflets: 18, spread: 0.3 }),
			frondPath(820, -30, 188, 360, rand, { leaflets: 18, spread: 0.3 }),
		];
	}, []);
	return (
		<svg className="login-backdrop" viewBox="0 0 1280 800" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true" focusable="false">
			<defs>
				<filter id="lbd-blur" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="9" />
				</filter>
			</defs>
			<g filter="url(#lbd-blur)">
				{paths.map((d, i) => (
					<path key={i} d={d} fill={i % 2 ? '#5f9a6f' : '#3f7a55'} opacity={i % 2 ? 0.55 : 0.7} />
				))}
			</g>
		</svg>
	);
}
