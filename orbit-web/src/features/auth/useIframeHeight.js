import { useEffect, useState } from 'react';

const MIN = 140;
const MAX = 760;
const SLACK = 20; // breathing room so the hosted page never needs its own scrollbar

/**
 * Height of the hosted page's REAL content: the lowest edge of any visible leaf element.
 * Deliberately not body/html height: hosted pages stretch those to fill the iframe, so measuring
 * them just returns the iframe's own height and (with slack added) makes the card grow forever.
 * Form controls (buttons, inputs) count with their whole box, not just their label. Hidden, fixed-position
 * (backgrounds) and empty elements are ignored.
 */
export function contentBottom(frame) {
	const doc = frame && frame.contentDocument;
	const win = frame && frame.contentWindow;
	if (!doc || !doc.body || !win) return null;
	let bottom = 0;
	for (const el of doc.body.querySelectorAll('*')) {
		if (el.children.length > 0 && !el.matches('button, input, select, textarea, .btn')) continue; // containers may be stretched; their leaves (and controls) are the truth
		const cs = win.getComputedStyle(el);
		if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
		const r = el.getBoundingClientRect();
		if (r.width === 0 && r.height === 0) continue;
		bottom = Math.max(bottom, r.bottom + (parseFloat(cs.marginBottom) || 0));
	}
	return bottom > 20 ? Math.ceil(bottom) : null;
}

/**
 * Sizes a container to the content of the Catalyst iframe mounted inside it. The hosted pages are
 * same-origin (the SDK itself reads their DOM), so the content can be measured. A ResizeObserver
 * inside the frame reacts to content changes (errors appearing, steps swapping) and a slow poll
 * re-attaches it when the frame navigates to a new document (sign-in -> forgot password). If
 * measuring is impossible the last good height - or `fallback` - is kept.
 */
export default function useIframeHeight(containerId, { enabled = true, fallback = 220, interval = 400 } = {}) {
	const [height, setHeight] = useState(fallback);

	useEffect(() => {
		if (!enabled) return undefined;
		let observedDoc = null;
		let observer = null;

		const apply = () => {
			try {
				const frame = document.getElementById(containerId)?.querySelector('iframe');
				const bottom = contentBottom(frame);
				if (bottom === null) return;
				const next = Math.min(Math.max(bottom + SLACK, MIN), MAX);
				setHeight((prev) => (Math.abs(prev - next) > 2 ? next : prev));
			} catch {
				/* cross-origin or detached: keep the current height */
			}
		};

		const attach = () => {
			try {
				const frame = document.getElementById(containerId)?.querySelector('iframe');
				const doc = frame && frame.contentDocument;
				if (!doc || !doc.body || doc === observedDoc) return;
				observedDoc = doc;
				if (observer) observer.disconnect();
				const RO = frame.contentWindow.ResizeObserver || window.ResizeObserver;
				if (RO) {
					observer = new RO(apply);
					doc.body.querySelectorAll('*').forEach((el) => el.children.length === 0 && observer.observe(el));
				}
				apply();
			} catch {
				/* not attachable yet */
			}
		};

		const tick = () => {
			attach();
			apply(); // also covers environments without ResizeObserver
		};
		const id = setInterval(tick, interval);
		tick();
		return () => {
			clearInterval(id);
			if (observer) observer.disconnect();
		};
	}, [containerId, enabled, interval]);

	return height;
}
