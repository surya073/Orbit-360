import { useEffect, useRef, useState } from 'react';

/** Tracks an element's width (ResizeObserver). Falls back to `fallback` where unsupported (tests). */
export default function useChartSize(fallback = 640) {
	const ref = useRef(null);
	const [width, setWidth] = useState(fallback);
	useEffect(() => {
		const node = ref.current;
		if (!node || typeof ResizeObserver === 'undefined') return undefined;
		const ro = new ResizeObserver(([entry]) => {
			const w = Math.round(entry.contentRect.width);
			if (w > 0) setWidth(w);
		});
		ro.observe(node);
		return () => ro.disconnect();
	}, []);
	return [ref, width];
}
