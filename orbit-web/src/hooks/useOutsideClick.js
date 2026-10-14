import { useEffect } from 'react';

/** Calls `onOutside` for a pointer press outside `ref` or when Escape is pressed (only while `active`). */
export default function useOutsideClick(ref, onOutside, active = true) {
	useEffect(() => {
		if (!active) return undefined;
		const down = (e) => ref.current && !ref.current.contains(e.target) && onOutside(e);
		const key = (e) => e.key === 'Escape' && onOutside(e);
		document.addEventListener('mousedown', down);
		document.addEventListener('keydown', key);
		return () => {
			document.removeEventListener('mousedown', down);
			document.removeEventListener('keydown', key);
		};
	}, [ref, onOutside, active]);
}
