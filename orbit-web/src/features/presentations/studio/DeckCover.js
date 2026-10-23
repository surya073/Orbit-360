import React from 'react';
import SlideCanvas from './SlideCanvas';
import { CANVAS_H, CANVAS_W, colorCss } from './slideModel';

/** A slide drawn for real and scaled down to `width` px wide (cards, the start page). Live widgets show as plain cards. */
export default function DeckCover({ slide, width = 300, className = '' }) {
	const k = width / CANVAS_W;
	return (
		<div className={`deck-cover ${className}`.trim()} style={{ width, height: Math.round(CANVAS_H * k) }} aria-hidden="true">
			<div className="deck-cover__scaled" style={{ transform: `scale(${k})` }}>
				<SlideCanvas
					slide={slide}
					animate={false}
					editing
					renderWidget={(o) => <div style={{ width: '100%', height: '100%', borderRadius: (o.st && o.st.r) ?? 28, background: colorCss(o.st && o.st.fill, 'color-mix(in srgb, currentColor 10%, transparent)') }} />}
				/>
			</div>
		</div>
	);
}
