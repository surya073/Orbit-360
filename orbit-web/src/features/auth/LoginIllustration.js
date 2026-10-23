import React from 'react';

/**
 * The sign-in artwork: a small flat-vector meeting scene (a presenter and a colleague at a table in front of a
 * dashboard screen), in the style of UI_Design/869a5d3c...jpg but drawn here from scratch. Pure SVG with fixed colours;
 * nothing in it is data, and its parent hides it from assistive technology.
 */
export default function LoginIllustration() {
	return (
		<svg className="login-illu" viewBox="0 40 640 428" preserveAspectRatio="xMidYMax meet" role="presentation" aria-hidden="true" focusable="false">
			{/* floor */}
			<ellipse cx="320" cy="446" rx="290" ry="13" fill="#eaf0fb" />

			{/* floating cards above the screen */}
			<g className="login-illu__float login-illu__float--a">
				<rect x="318" y="86" width="104" height="62" rx="7" fill="#e9eef9" />
				<circle cx="340" cy="108" r="11" fill="#b4c3e3" />
				<rect x="358" y="100" width="48" height="6" rx="3" fill="#c7d2ec" />
				<rect x="358" y="113" width="34" height="6" rx="3" fill="#d5ddf1" />
				<rect x="330" y="132" width="76" height="5" rx="2.5" fill="#d5ddf1" />
			</g>
			<g className="login-illu__float login-illu__float--b">
				<rect x="496" y="58" width="92" height="62" rx="7" fill="#e9eef9" />
				<circle cx="524" cy="86" r="13" fill="none" stroke="#b4c3e3" strokeWidth="6" />
				<circle cx="524" cy="86" r="13" fill="none" stroke="#7d95d6" strokeWidth="6" strokeDasharray="30 52" transform="rotate(-90 524 86)" />
				<rect x="546" y="78" width="30" height="5" rx="2.5" fill="#c7d2ec" />
				<rect x="546" y="90" width="22" height="5" rx="2.5" fill="#d5ddf1" />
			</g>

			{/* monitor */}
			<g transform="translate(366 128)">
				<rect width="236" height="150" rx="9" fill="#b9c7e2" />
				<rect x="8" y="8" width="220" height="134" rx="5" fill="#f4f7fd" />
				<rect x="18" y="18" width="70" height="8" rx="4" fill="#c7d2ec" />
				<circle cx="46" cy="66" r="24" fill="none" stroke="#dde4f5" strokeWidth="11" />
				<circle cx="46" cy="66" r="24" fill="none" stroke="#5b7cfa" strokeWidth="11" strokeDasharray="82 151" transform="rotate(-90 46 66)" />
				<circle cx="46" cy="66" r="24" fill="none" stroke="#2f9e78" strokeWidth="11" strokeDasharray="30 151" strokeDashoffset="-86" transform="rotate(-90 46 66)" />
				<g fill="#9db0d9">
					<rect x="100" y="92" width="14" height="36" rx="3" />
					<rect x="122" y="76" width="14" height="52" rx="3" />
					<rect x="144" y="84" width="14" height="44" rx="3" />
					<rect x="166" y="62" width="14" height="66" rx="3" fill="#5b7cfa" />
					<rect x="188" y="72" width="14" height="56" rx="3" />
				</g>
				<path d="M98 56 C 118 40, 132 60, 152 44 S 186 36, 210 30" fill="none" stroke="#2f9e78" strokeWidth="3" strokeLinecap="round" />
				<rect x="18" y="112" width="60" height="6" rx="3" fill="#d5ddf1" />
				<rect x="18" y="124" width="44" height="6" rx="3" fill="#d5ddf1" />
				<rect x="105" y="150" width="26" height="22" fill="#b9c7e2" />
				<rect x="74" y="168" width="88" height="9" rx="4.5" fill="#b9c7e2" />
			</g>

			{/* table */}
			<rect x="150" y="304" width="470" height="13" rx="6.5" fill="#e3e9f6" />
			<rect x="178" y="317" width="8" height="126" fill="#cdd7ec" />
			<rect x="580" y="317" width="8" height="126" fill="#cdd7ec" />

			{/* seated colleague (left) */}
			<g>
				<rect x="96" y="262" width="16" height="116" rx="8" fill="#d4dcec" transform="rotate(-6 104 320)" />
				<rect x="100" y="372" width="118" height="13" rx="6.5" fill="#d4dcec" />
				<rect x="122" y="385" width="6" height="58" fill="#c3cde4" />
				<rect x="198" y="385" width="6" height="58" fill="#c3cde4" />
				{/* legs */}
				<rect x="150" y="352" width="140" height="32" rx="16" fill="#2c4678" />
				<rect x="268" y="360" width="30" height="82" rx="14" fill="#35508a" />
				<ellipse cx="290" cy="444" rx="24" ry="9" fill="#e8294f" />
				{/* torso */}
				<rect x="132" y="252" width="82" height="128" rx="28" fill="#35508a" />
				<path d="M160 254 L172 300 L184 254 Z" fill="#f1f4fb" />
				<path d="M168 262 L172 300 L176 262 Z" fill="#e8294f" />
				{/* arm pointing at the screen */}
				<path d="M200 280 Q 262 262 340 268" fill="none" stroke="#2c4678" strokeWidth="24" strokeLinecap="round" />
				<circle cx="346" cy="268" r="9" fill="#f9b79a" />
				{/* head */}
				<circle cx="172" cy="222" r="25" fill="#f9b79a" />
				<path d="M146 220 C 146 190, 196 190, 198 220 C 192 206, 160 206, 146 220 Z" fill="#1f2d52" />
				<path d="M150 232 C 156 258, 188 258, 194 232 C 186 244, 158 244, 150 232 Z" fill="#1f2d52" />
			</g>

			{/* standing presenter (front) */}
			<g>
				<rect x="352" y="318" width="22" height="124" rx="10" fill="#ec2f55" />
				<rect x="378" y="318" width="22" height="124" rx="10" fill="#d9264b" />
				<ellipse cx="364" cy="445" rx="20" ry="7" fill="#1f2d52" />
				<ellipse cx="392" cy="445" rx="20" ry="7" fill="#1f2d52" />
				<rect x="342" y="222" width="68" height="112" rx="26" fill="#f1f4fb" />
				{/* arm to the chin, arm on the hip */}
				<path d="M404 246 Q 432 262 414 214" fill="none" stroke="#f9b79a" strokeWidth="12" strokeLinecap="round" />
				<path d="M346 250 Q 322 276 346 312" fill="none" stroke="#f9b79a" strokeWidth="12" strokeLinecap="round" />
				<circle cx="376" cy="196" r="22" fill="#f9b79a" />
				<path d="M352 196 C 346 160, 392 150, 404 180 C 408 200, 400 220, 408 236 C 394 226, 392 206, 388 186 C 376 180, 362 184, 352 196 Z" fill="#1f2d52" />
			</g>

			{/* plant */}
			<g>
				<rect x="566" y="398" width="42" height="46" rx="7" fill="#cdd7ec" />
				<path d="M587 400 C 560 380, 548 352, 566 330 C 580 350, 588 372, 587 400 Z" fill="#2f9e78" />
				<path d="M587 400 C 612 384, 628 356, 612 334 C 598 352, 588 374, 587 400 Z" fill="#1f7a5c" />
				<path d="M587 400 C 584 372, 590 346, 600 322 C 606 348, 600 376, 587 400 Z" fill="#3cb58c" />
				<path d="M587 400 C 556 398, 536 384, 534 366 C 556 368, 574 380, 587 400 Z" fill="#1f7a5c" />
			</g>
		</svg>
	);
}

/**
 * The page behind the card: a deep blue "meeting room" with translucent video-call tiles, a calendar card, a clock and
 * chat bubbles drifting slowly, one tile marked as the person speaking.
 */
export function LoginBackdrop() {
	const tiles = [
		{ x: 70, y: 90, w: 190, h: 120, speaking: false },
		{ x: 280, y: 60, w: 190, h: 120, speaking: true },
		{ x: 990, y: 110, w: 190, h: 120, speaking: false },
		{ x: 60, y: 560, w: 190, h: 120, speaking: false },
		{ x: 1010, y: 560, w: 190, h: 120, speaking: false },
	];
	return (
		<svg className="login-backdrop" viewBox="0 0 1280 760" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true" focusable="false">
			<defs>
				<radialGradient id="lbd-glow" cx="0.5" cy="0.4" r="0.7">
					<stop offset="0" stopColor="#4a63d8" stopOpacity="0.55" />
					<stop offset="1" stopColor="#4a63d8" stopOpacity="0" />
				</radialGradient>
			</defs>
			<rect width="1280" height="760" fill="url(#lbd-glow)" />
			{tiles.map((t, i) => (
				<g key={i} className="login-backdrop__tile" style={{ '--i': i }}>
					<rect x={t.x} y={t.y} width={t.w} height={t.h} rx="14" fill="#ffffff" fillOpacity="0.09" stroke={t.speaking ? '#5de0a8' : '#ffffff'} strokeOpacity={t.speaking ? 0.85 : 0.16} strokeWidth={t.speaking ? 2.5 : 1.2} />
					<circle cx={t.x + t.w / 2} cy={t.y + t.h / 2 - 8} r="22" fill="#ffffff" fillOpacity="0.16" />
					<path d={`M${t.x + t.w / 2 - 34} ${t.y + t.h - 6} C ${t.x + t.w / 2 - 30} ${t.y + t.h - 40}, ${t.x + t.w / 2 + 30} ${t.y + t.h - 40}, ${t.x + t.w / 2 + 34} ${t.y + t.h - 6}`} fill="#ffffff" fillOpacity="0.12" />
					<rect x={t.x + 10} y={t.y + t.h - 22} width="52" height="8" rx="4" fill="#ffffff" fillOpacity="0.22" />
				</g>
			))}
			<g className="login-backdrop__tile" style={{ '--i': 5 }}>
				<rect x="520" y="620" width="240" height="90" rx="14" fill="#ffffff" fillOpacity="0.08" stroke="#ffffff" strokeOpacity="0.14" />
				<circle cx="560" cy="665" r="14" fill="#ffffff" fillOpacity="0.2" />
				<rect x="586" y="650" width="120" height="8" rx="4" fill="#ffffff" fillOpacity="0.24" />
				<rect x="586" y="668" width="84" height="8" rx="4" fill="#ffffff" fillOpacity="0.16" />
			</g>
			<g className="login-backdrop__tile" style={{ '--i': 6 }}>
				<rect x="800" y="40" width="150" height="150" rx="14" fill="#ffffff" fillOpacity="0.08" stroke="#ffffff" strokeOpacity="0.14" />
				<rect x="800" y="40" width="150" height="32" rx="14" fill="#ffffff" fillOpacity="0.14" />
				{[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4, 5].map((c) => <circle key={`${r}-${c}`} cx={818 + c * 22} cy={92 + r * 18} r="3.2" fill="#ffffff" fillOpacity={r === 2 && c === 3 ? 0.9 : 0.25} />))}
			</g>
			<g className="login-backdrop__tile" style={{ '--i': 7 }}>
				<circle cx="1130" cy="400" r="36" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="2" />
				<path d="M1130 380 V400 L1144 408" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round" />
			</g>
			<g className="login-backdrop__tile" style={{ '--i': 8 }}>
				<path d="M150 330 h120 a14 14 0 0 1 14 14 v34 a14 14 0 0 1 -14 14 h-70 l-24 20 v-20 h-26 a14 14 0 0 1 -14 -14 v-34 a14 14 0 0 1 14 -14 z" fill="#ffffff" fillOpacity="0.08" stroke="#ffffff" strokeOpacity="0.16" />
				<rect x="146" y="350" width="90" height="7" rx="3.5" fill="#ffffff" fillOpacity="0.24" />
				<rect x="146" y="366" width="60" height="7" rx="3.5" fill="#ffffff" fillOpacity="0.16" />
			</g>
		</svg>
	);
}
