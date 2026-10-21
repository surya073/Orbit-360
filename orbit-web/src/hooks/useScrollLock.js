import { useEffect } from 'react';
import { lockScroll } from '../utils/scrollLock';

/** Keeps the page behind from scrolling while the component is mounted (or while `active`). */
export default function useScrollLock(active = true) {
	useEffect(() => (active ? lockScroll() : undefined), [active]);
}
