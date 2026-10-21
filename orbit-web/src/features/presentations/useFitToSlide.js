import { useLayoutEffect } from 'react';

const MIN_SCALE = 0.5;
const RESET = ['transform', 'transformOrigin', 'width', 'height', 'flex', 'marginRight', 'marginBottom'];

/**
 * A slide never scrolls. When its content is taller than the room the slide gives it, the content is scaled down to
 * fit (and re-measured whenever it changes, for example when live data arrives). The element keeps its place in the
 * layout: it is made larger by the same factor and pulled back with negative margins, so nothing around it moves.
 */
export default function useFitToSlide(ref) {
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el || typeof MutationObserver === 'undefined') return undefined;
		let frame = 0;
		const reset = () => RESET.forEach((k) => (el.style[k] = ''));
		const fit = () => {
			reset();
			const H = el.clientHeight;
			const W = el.clientWidth;
			if (H <= 0 || el.scrollHeight <= H + 2) return;
			let f = Math.max(MIN_SCALE, H / el.scrollHeight);
			for (let pass = 0; pass < 4; pass++) {
				el.style.flex = 'none';
				el.style.transformOrigin = 'top left';
				el.style.transform = `scale(${f})`;
				el.style.width = `${W / f}px`;
				el.style.height = `${H / f}px`;
				el.style.marginRight = `${W - W / f}px`;
				el.style.marginBottom = `${H - H / f}px`;
				// wider content reflows shorter, so it usually fits at once; if not, shrink a little more
				if (el.scrollHeight <= el.clientHeight + 2 || f <= MIN_SCALE) break;
				f = Math.max(MIN_SCALE, f * 0.96);
			}
		};
		const schedule = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(fit);
		};
		fit();
		const observer = new MutationObserver(schedule);
		observer.observe(el, { childList: true, subtree: true, characterData: true });
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, [ref]);
}
