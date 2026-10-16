import { useEffect } from 'react';
import { motionReduced } from '../utils/motion';

/**
 * Scroll-triggered entrance for a page's card grid (the dashboard's KPI cards and widgets; a module's summary cards and table). Each card gets `bento`
 * (frame hidden, its charts and bars held at their start state) and, once it is in view, `is-in`: the frame
 * lands first, then the content draws (styles/bento.css). Cards already on screen when scanned play at once.
 * Nothing is hidden without IntersectionObserver or for reduced-motion users, and tests never see it.
 */
const DEFAULT_SELECTOR = '.grid--kpi > .card, .grid--widgets > .widget';

export default function useBentoReveal(rootSelector, deps, selector = DEFAULT_SELECTOR) {
	useEffect(() => {
		const root = document.querySelector(rootSelector);
		if (!root || typeof IntersectionObserver === 'undefined') return undefined;
		if (motionReduced()) return undefined;
		const seen = new WeakSet();
		const io = new IntersectionObserver(
			(entries) =>
				entries.forEach((en) => {
					if (!en.isIntersecting) return;
					en.target.classList.add('is-in');
					io.unobserve(en.target);
				}),
			{ threshold: 0.18, rootMargin: '0px 0px -4% 0px' }
		);
		const scan = () => {
			root.querySelectorAll(selector).forEach((el) => {
				if (seen.has(el)) return;
				seen.add(el);
				const siblings = [...el.parentElement.children];
				el.style.setProperty('--k', String(Math.max(0, siblings.indexOf(el))));
				el.classList.add('bento');
				if (el.getBoundingClientRect().top < window.innerHeight * 0.92) el.classList.add('is-in');
				else io.observe(el);
			});
		};
		scan();
		const mo = new MutationObserver(scan);
		mo.observe(root, { childList: true, subtree: true });
		return () => {
			mo.disconnect();
			io.disconnect();
			root.querySelectorAll('.bento').forEach((el) => el.classList.remove('bento', 'is-in'));
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps);
}
