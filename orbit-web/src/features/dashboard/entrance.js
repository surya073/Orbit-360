import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Dashboard entrance: the cinematic sequence (styles/dashEntrance.css) plays the first time the dashboard
 * opens in a browser session. Coming back to it later in the same session uses the quick fade the page
 * always had, so filters, refreshes and navigation never replay a long intro.
 */
const SEEN_KEY = 'company360.dashIntro';

/** Pure: which entrance to use. Reduced motion never gets the cinematic one. */
export const chooseEntrance = ({ seen, reducedMotion }) => (seen || reducedMotion ? 'quick' : 'cinematic');

export const prefersReducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

const readSeen = () => {
	try {
		return window.sessionStorage.getItem(SEEN_KEY) === '1';
	} catch {
		return true; // storage blocked: do not risk replaying on every visit
	}
};

/** 'cinematic' on the first visit of the session, otherwise 'quick'. Decided once per mount. */
export function useDashboardEntrance() {
	const [mode] = useState(() => chooseEntrance({ seen: readSeen(), reducedMotion: prefersReducedMotion() })); // read-only here: safe under StrictMode's double render
	useEffect(() => {
		try {
			window.sessionStorage.setItem(SEEN_KEY, '1');
		} catch {
			/* not remembered */
		}
	}, []);
	return mode;
}

/** True inside a dashboard that is playing the cinematic entrance (so cards may count up). */
export const EntranceContext = createContext(false);
export const useCinematic = () => useContext(EntranceContext);

// ---- count-up --------------------------------------------------------------------------------------

const NUMBER = /-?\d[\d,]*(?:\.\d+)?/;
export const hasNumber = (text) => typeof text === 'string' && NUMBER.test(text);
const easeOut = (p) => 1 - (1 - p) ** 3;

/**
 * The first number in an already formatted value, scaled to progress `p` (0..1), keeping its decimals and
 * digit grouping. At p >= 1 (and for text with no number) the original text is returned exactly, so the
 * final value on screen is always the real, formatted one.
 */
export function countUpText(text, p) {
	const m = hasNumber(text) ? NUMBER.exec(text) : null;
	if (!m || p >= 1) return text;
	const raw = m[0];
	const target = parseFloat(raw.replace(/,/g, ''));
	if (!Number.isFinite(target)) return text;
	const decimals = raw.includes('.') ? raw.split('.')[1].length : 0;
	const shown = (target * easeOut(Math.max(p, 0))).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: raw.includes(',') });
	return text.slice(0, m.index) + shown + text.slice(m.index + raw.length);
}

const DURATION_MS = 950;

/**
 * Renders `text`; when `enabled`, counts its number up once, the first time a real value arrives (not on
 * later refreshes). Only this small leaf re-renders while counting.
 */
export function CountUp({ text, enabled = true }) {
	const eligible = enabled && hasNumber(text);
	const [phase, setPhase] = useState('idle'); // idle -> running -> done
	const [progress, setProgress] = useState(0);
	const latest = useRef(text);
	latest.current = text;

	// Start before the first paint so the final value is never flashed.
	useLayoutEffect(() => {
		if (eligible && phase === 'idle') {
			setProgress(0);
			setPhase('running');
		}
	}, [eligible, phase]);

	useEffect(() => {
		if (phase !== 'running') return undefined;
		let raf = 0;
		const start = performance.now();
		const tick = () => {
			const p = Math.min((performance.now() - start) / DURATION_MS, 1); // one clock for start and now
			setProgress(p);
			if (p < 1) raf = requestAnimationFrame(tick);
			else setPhase('done');
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [phase]);

	return <>{phase === 'running' ? countUpText(latest.current, progress) : text}</>;
}
