import { useEffect } from 'react';
import { motionReduced } from '../utils/motion';

/**
 * Scroll-triggered entrance for a page's card grid (the dashboard's KPI cards and widgets; a module's summary cards and table). Each card gets `bento`
 * (frame hidden, its charts and bars held at their start state) and, once it is in view, `is-in`: the frame
 * lands first, then the content draws (styles/bento.css). Cards already on screen when scanned play at once.
 * Nothing is hidden without IntersectionObserver or for reduced-motion users, and tests never see it.
 */
const DEFAULT_SELECTOR = '.grid--kpi > .card, .grid--widgets > .widget';
/** Every page: the blocks that make up a screen (the dashboard and module pages run their own, richer selectors). */
export const PAGE_SELECTOR = ['.card', '.sig-card', '.table-wrap', '.banner', '.filter-bar', '.pager', '.access-stat', '.access-role', '.empty', '.rs-card', '.settings-section', '.pcard', '.pthemecard', '.hcard'].join(',');
const ALWAYS_SKIP = '.sheet, .sheet-editor, [data-no-reveal], .modal, [role="dialog"], .popover, .select__menu';
const MAX_STAGGER = 6; // so the twelfth card in a list does not wait a second

/** `skip` is a selector for blocks another reveal already owns (e.g. '.dash, .mod'). */
export default function useBentoReveal(rootSelector, deps, selector = DEFAULT_SELECTOR, skip = '') {
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
			{ threshold: 0.18 } // no bottom margin: a block at the very end of a short page must still be able to reveal
		);
		const scan = () => {
			root.querySelectorAll(selector).forEach((el) => {
				if (seen.has(el)) return;
				seen.add(el);
				if (el.closest(ALWAYS_SKIP) || (skip && el.closest(skip))) return;
				if (el.parentElement && el.parentElement.closest('.bento')) return; // a card inside a revealed card rides along with it
				const siblings = [...el.parentElement.children];
				el.style.setProperty('--k', String(Math.min(MAX_STAGGER, Math.max(0, siblings.indexOf(el)))));
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
