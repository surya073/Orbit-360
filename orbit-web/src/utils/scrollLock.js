/**
 * One page scroll lock for every modal, drawer and launcher. Locks are counted, so a dialog opened on top of another one
 * (or a drawer plus a dialog) never unlocks the page early; the page is released only when the last lock is let go.
 *
 * The page scrolls on <html>, so only <html> gets `overflow: hidden`. The body is NOT touched and NOT pinned with
 * `position: fixed`: either would turn the body into its own container, and the sticky sidebar and header would be carried
 * away by the scroll distance (the page behind a dialog would jump and look broken). With <html> hidden the scroll offset
 * simply stays where it was, and scrollbars are hidden app-wide, so nothing shifts sideways. The offset is put back on
 * release as a safeguard.
 */
let locks = 0;
let saved = null;

function apply() {
	const root = document.documentElement;
	const y = window.scrollY || root.scrollTop || 0;
	saved = { y, rootOverflow: root.style.overflow, rootOverscroll: root.style.overscrollBehavior };
	root.style.overflow = 'hidden'; // only <html>: the page's scroll container. Hiding the body's overflow too would make the body its own container and the sticky sidebar would scroll away.
	root.style.overscrollBehavior = 'none';
}

function restore() {
	const root = document.documentElement;
	const s = saved;
	saved = null;
	if (!s) return;
	root.style.overflow = s.rootOverflow;
	root.style.overscrollBehavior = s.rootOverscroll;
	if ((window.scrollY || root.scrollTop || 0) !== s.y) window.scrollTo({ top: s.y, left: 0, behavior: 'instant' });
}

/** Locks page scrolling and returns the function that releases this one lock (safe to call twice). */
export function lockScroll() {
	if (locks === 0) apply();
	locks += 1;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		locks -= 1;
		if (locks === 0) restore();
	};
}

export const isScrollLocked = () => locks > 0;
