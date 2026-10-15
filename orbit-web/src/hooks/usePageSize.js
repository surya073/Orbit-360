import { useCallback, useState } from 'react';
import { PAGE_SIZE, PAGE_SIZES } from '../config/constants';

const key = (name) => `company360.pageSize.${name}`;

function read(name, fallback) {
	try {
		const n = Number(window.localStorage.getItem(key(name)));
		return PAGE_SIZES.includes(n) ? n : fallback;
	} catch {
		return fallback;
	}
}

/** Rows-per-page for one table, remembered per device. Always one of PAGE_SIZES. */
export default function usePageSize(name, fallback = PAGE_SIZE) {
	const [size, setSize] = useState(() => read(name, fallback));
	const change = useCallback(
		(n) => {
			const v = PAGE_SIZES.includes(Number(n)) ? Number(n) : fallback;
			setSize(v);
			try {
				window.localStorage.setItem(key(name), String(v));
			} catch {
				/* the choice just is not remembered */
			}
		},
		[name, fallback]
	);
	return [size, change];
}
