import React from 'react';

// Spreadsheet-only editing glyphs (Google Sheets-style toolbar). They are drawn once here, as plain
// strokes, because the app-wide icon sets have no equivalents; everything else uses components/common/Icon.
const PATHS = {
	print: 'M7 9V4h10v5 M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2 M7 14h10v6H7z',
	paint: 'M6 4h11a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M18 6.5h2V11h-8v3 M10.5 14h3v6.5h-3z',
	strike: 'M4 12h16 M16.5 7.5C15.8 6 14.2 5 12 5 9.5 5 7.8 6.2 7.8 8c0 1.2.8 2.1 2.4 2.7 M7.5 16.5C8.2 18 9.8 19 12 19c2.6 0 4.4-1.2 4.4-3.1 0-1-.4-1.7-1.2-2.3',
	borders: 'M4 4h16v16H4z M4 12h16 M12 4v16',
	merge: 'M4 4h16v16H4z M9 9.5L7 12l2 2.5 M15 9.5l2 2.5-2 2.5 M7 12h10',
	alignLeft: 'M4 6h16 M4 10h10 M4 14h16 M4 18h10',
	alignCenter: 'M4 6h16 M7 10h10 M4 14h16 M7 18h10',
	alignRight: 'M4 6h16 M10 10h10 M4 14h16 M10 18h10',
	valignTop: 'M4 4h16 M12 20V9 M8 12.5l4-4 4 4',
	valignMiddle: 'M4 12h16 M12 4v5 M9 6.5l3 3 3-3 M12 20v-5 M9 17.5l3-3 3 3',
	valignBottom: 'M4 20h16 M12 4v11 M8 11.5l4 4 4-4',
	wrap: 'M4 6h16 M4 12h13a3 3 0 0 1 0 6h-4 M15.5 15.5L13 18l2.5 2.5 M4 18h5',
	rotate: 'M5 19L15 9 M10 6h8v8',
	link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
	comment: 'M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-9l-4 4v-4H5a1 1 0 0 1-1-1z M12 8v5 M9.5 10.5h5',
	chart: 'M4 4v16h16 M8 16v-5 M12 16V8 M16 16v-3',
	views: 'M4 5h16v14H4z M4 10h16 M10 5v14',
	sigma: 'M18 5H6l6 7-6 7h12',
	minus: 'M6 12h12',
	plus: 'M12 6v12 M6 12h12',
	chevUp: 'M6 15l6-6 6 6',
	caret: 'M8 10l4 4 4-4',
};

export default function SheetGlyph({ name, size = 18 }) {
	const d = PATHS[name];
	if (!d) return null;
	return (
		<svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false" aria-hidden="true">
			{d.split(' M').map((seg, i) => (
				<path key={i} d={i === 0 ? seg : `M${seg}`} />
			))}
		</svg>
	);
}
