/** True when animations should be skipped: the device asks for reduced motion, or Settings -> Motion is set to reduced. */
export function motionReduced() {
	const root = typeof document !== 'undefined' ? document.documentElement : null;
	if (root && root.dataset.motion === 'reduced') return true;
	return Boolean(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
