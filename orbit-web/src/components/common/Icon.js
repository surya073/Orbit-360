import React from 'react';
import { ICON_STYLES } from '../../config/icons';
import { ICON_SETS } from './iconSets';
import { useIconStyle } from './iconStyle';

// "Classic" set: the original 24x24 hand-drawn stroke icons. Every other set is a react-icons family
// (iconSets.js). A new icon needs an entry in the classic map AND in the generator table (tests enforce parity).
const CLASSIC = {
	dashboard: 'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z',
	users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
	team: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
	user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
	clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 6v6l4 2',
	calendar: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
	trend: 'M22 7l-8.5 8.5-5-5L2 17 M16 7h6v6',
	folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
	box: 'M21 8l-9-5-9 5v8l9 5 9-5z M3.3 7.5L12 12.5l8.7-5 M12 22V12.5',
	sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9z',
	upload: 'M12 16V4 M7 9l5-5 5 5 M4 20h16',
	download: 'M12 4v12 M7 11l5 5 5-5 M4 20h16',
	present: 'M3 4h18v12H3z M8 20h8 M12 16v4',
	search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16 M21 21l-4.3-4.3',
	bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0',
	menu: 'M3 6h18 M3 12h18 M3 18h18',
	x: 'M18 6L6 18 M6 6l12 12',
	chevronDown: 'M6 9l6 6 6-6',
	chevronLeft: 'M15 18l-6-6 6-6',
	chevronRight: 'M9 18l6-6-6-6',
	plus: 'M12 5v14 M5 12h14',
	edit: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
	trash: 'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6',
	check: 'M20 6L9 17l-5-5',
	alert: 'M12 9v4 M12 17h.01 M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0',
	info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 16v-4 M12 8h.01',
	logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
	settings: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
	sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10 M12 1v2 M12 21v2 M4.2 4.2l1.4 1.4 M18.4 18.4l1.4 1.4 M1 12h2 M21 12h2 M4.2 19.8l1.4-1.4 M18.4 5.6l1.4-1.4',
	moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
	palette: 'M12 22a10 10 0 1 1 10-10c0 3-2 4-4 4h-2a2 2 0 0 0-1 3.7c.6.6.4 2.3-3 2.3 M7.5 11h.01 M10.5 7h.01 M15.5 8h.01',
	filter: 'M22 3H2l8 9.5V19l4 2v-8.5z',
	play: 'M6 4l14 8-14 8z',
	external: 'M14 4h6v6 M10 14L20 4 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
	refresh: 'M21 12a9 9 0 1 1-3-6.7 M21 3v6h-6',
	lock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4',
};

const DEFAULT_SET = ICON_STYLES[0].id;

/**
 * One icon, in the user's chosen set (Settings -> Appearance), or in `variant` when given (used by
 * the style previews). Decorative by default; pass `label` to expose it to assistive technology.
 */
export default function Icon({ name, size = 16, label, className = '', variant }) {
	const current = useIconStyle();
	const styleId = variant || current;
	const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
	const cls = `icon ${className}`.trim();

	if (styleId === 'classic') {
		const d = CLASSIC[name];
		if (!d) return null;
		return (
			<svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" focusable="false" {...a11y}>
				{d.split(' M').map((seg, i) => (
					<path key={i} d={i === 0 ? seg : `M${seg}`} />
				))}
			</svg>
		);
	}

	const Glyph = (ICON_SETS[styleId] || ICON_SETS[DEFAULT_SET])[name];
	if (!Glyph) return null;
	return <Glyph className={cls} size={size} focusable="false" {...a11y} />;
}

export const ICON_NAMES = Object.keys(CLASSIC);
