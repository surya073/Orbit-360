/**
 * One page scroll lock for every modal, drawer and launcher. Locks are counted, so a dialog opened on top of another one
 * (or a drawer plus a dialog) never unlocks the page early; the page is released only when the last lock is let go.
 *
 * The page scrolls on <html>, so locking <body> alone does nothing: both get `overflow: hidden`, and the body is also
 * pinned with `position: fixed` (the only thing mobile Safari respects). The scroll position is kept and restored.
 * Scrollbars are hidden app-wide, so nothing shifts sideways when the lock is applied.
 */
let locks = 0;
let saved = null;

function apply() {
	const root = document.documentElement;
	const body = document.body;
	const y = window.scrollY || root.scrollTop || 0;
	saved = { y, rootOverflow: root.style.overflow, bodyOverflow: body.style.overflow, bodyPosition: body.style.position, bodyTop: body.style.top, bodyWidth: body.style.width };
	root.style.overflow = 'hidden';
	body.style.overflow = 'hidden';
	body.style.position = 'fixed';
	body.style.top = `-${y}px`;
	body.style.width = '100%';
}

function restore() {
	const root = document.documentElement;
	const body = document.body;
	const s = saved;
	saved = null;
	if (!s) return;
	root.style.overflow = s.rootOverflow;
	body.style.overflow = s.bodyOverflow;
	body.style.position = s.bodyPosition;
	body.style.top = s.bodyTop;
	body.style.width = s.bodyWidth;
	window.scrollTo({ top: s.y, left: 0, behavior: 'instant' });
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
