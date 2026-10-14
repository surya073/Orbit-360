import React from 'react';

/**
 * Decorative dashboard motif for the sign-in brand panel. Pure SVG painted with the theme's chart
 * tokens, so it re-colors with every theme. It shows no numbers (nothing here is data).
 */
export default function LoginArt() {
	const bars = [34, 52, 44, 68, 58, 82, 74];
	return (
		<svg className="login-art" viewBox="0 0 360 220" role="presentation" aria-hidden="true" focusable="false">
			<rect x="0.5" y="0.5" width="359" height="219" rx="14" fill="var(--login-panel-card)" stroke="var(--login-panel-line)" />
			<g transform="translate(22 24)">
				<rect width="64" height="8" rx="4" fill="var(--login-panel-line)" />
				<rect y="18" width="110" height="14" rx="5" fill="var(--login-panel-ink)" opacity="0.9" />
			</g>
			<g transform="translate(22 76)">
				{bars.map((h, i) => (
					<rect key={i} className="login-art__bar" x={i * 30} y={104 - h} width="18" height={h} rx="5" fill={i % 2 ? 'var(--chart-2)' : 'var(--chart-1)'} style={{ animationDelay: `${i * 70}ms` }} />
				))}
				<line x1="0" x2="214" y1="105" y2="105" stroke="var(--login-panel-line)" />
			</g>
			<g transform="translate(250 24)">
				<circle cx="44" cy="44" r="34" fill="none" stroke="var(--login-panel-line)" strokeWidth="12" />
				<circle className="login-art__seg" cx="44" cy="44" r="34" fill="none" stroke="var(--chart-3)" strokeWidth="12" strokeDasharray="120 214" strokeLinecap="round" transform="rotate(-90 44 44)" />
				<circle className="login-art__seg" cx="44" cy="44" r="34" fill="none" stroke="var(--chart-4)" strokeWidth="12" strokeDasharray="44 214" strokeDashoffset="-128" strokeLinecap="round" transform="rotate(-90 44 44)" />
			</g>
			<g transform="translate(250 126)">
				<rect width="88" height="9" rx="4.5" fill="var(--login-panel-line)" />
				<rect y="20" width="64" height="9" rx="4.5" fill="var(--login-panel-line)" />
				<rect y="40" width="76" height="9" rx="4.5" fill="var(--login-panel-line)" />
			</g>
			<path d="M22 186 C 70 160, 110 176, 150 150 S 230 140, 338 118" fill="none" stroke="var(--chart-5)" strokeWidth="2.5" strokeLinecap="round" className="login-art__line" />
		</svg>
	);
}
