import { useEffect } from 'react';
import { motionReduced } from '../utils/motion';

/**
 * Scroll reveal (the same idea as the AOS library, without the dependency): blocks that start below the
 * fold fade and rise into place the first time they scroll into view; blocks already on screen are left
 * alone, so nothing is ever hidden that the user can see. Staggers siblings that sit in the same row.
 * The classes are removed again once the transition ends, so cards keep their own hover transitions.
 * Does nothing for reduced-motion users or browsers without IntersectionObserver.
 *
 * `root` is the element whose subtree is scanned; `deps` re-scan when the route changes.
 */
const TARGETS = ['.card', '.sig-card', '.table-wrap', '.banner', '.filter-bar', '.pager', '.access-stat', '.access-role', '.empty', '.rs-card', '.settings-section', '.pcard', '.pthemecard', '.hcard'].join(',');
const SKIP = '.sheet, .sheet-editor, [data-no-reveal], .modal, [role="dialog"], .bento';
const MAX_STAGGER = 4;

export default function useScrollReveal(rootSelector, deps) {
	useEffect(() => {
		const root = document.querySelector(rootSelector);
		if (!root || typeof IntersectionObserver === 'undefined') return undefined;
		if (motionReduced()) return undefined;

		const seen = new WeakSet();
		const timers = new Set();
		const io = new IntersectionObserver(
			(entries) => {
				entries.forEach((en) => {
					if (!en.isIntersecting) return;
					const el = en.target;
					io.unobserve(el);
					el.classList.add('reveal--in');
					const done = () => {
						el.classList.remove('reveal', 'reveal--in');
						el.style.removeProperty('--reveal-delay');
						el.removeAttribute('data-reveal');
					};
					el.addEventListener('transitionend', (e) => e.target === el && e.propertyName === 'opacity' && done(), { once: false });
					const t = setTimeout(done, 1600); // safety net if the transition never ends (display:none, tab hidden)
					timers.add(t);
				});
			},
			{ threshold: 0.08, rootMargin: '0px 0px -6% 0px' }
		);

		const scan = () => {
			const fresh = [];
			root.querySelectorAll(TARGETS).forEach((el) => {
				if (seen.has(el)) return;
				seen.add(el);
				if (el.closest(SKIP) || (el.parentElement && el.parentElement.closest('.reveal'))) return;
				if (el.parentElement && el.parentElement.closest(TARGETS) && el.parentElement.closest(TARGETS).classList.contains('reveal')) return;
				const r = el.getBoundingClientRect();
				if (r.height === 0 || r.top < window.innerHeight * 0.96) return; // visible now: leave it to the page's own entrance
				fresh.push([el, r]);
			});
			fresh.forEach(([el, r], i) => {
				const row = fresh.slice(0, i).filter(([, o]) => Math.abs(o.top - r.top) < 48);
				el.style.setProperty('--reveal-delay', `${Math.min(row.length, MAX_STAGGER) * 90}ms`);
				if (row.length > 0 && r.width < root.clientWidth * 0.7) el.setAttribute('data-reveal', r.left > root.getBoundingClientRect().left + root.clientWidth / 2 ? 'left' : 'right');
				el.classList.add('reveal');
				io.observe(el);
			});
		};

		let raf = 0;
		const schedule = () => {
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(scan);
		};
		const first = setTimeout(scan, 60); // after the route's content has mounted
		const mo = new MutationObserver(schedule); // late data, tabs and lists add blocks after the first paint
		mo.observe(root, { childList: true, subtree: true });
		return () => {
			clearTimeout(first);
			cancelAnimationFrame(raf);
			timers.forEach(clearTimeout);
			mo.disconnect();
			io.disconnect();
			root.querySelectorAll('.reveal').forEach((el) => el.classList.remove('reveal', 'reveal--in'));
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps);
}
