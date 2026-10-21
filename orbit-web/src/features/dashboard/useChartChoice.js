import { useCallback, useState } from 'react';

const KEY = 'company360.dashboardCharts';

const read = () => {
	try {
		const v = JSON.parse(window.localStorage.getItem(KEY) || '{}');
		return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
	} catch {
		return {};
	}
};

/**
 * A dashboard card's chart choice ({ metric, type, ... }), remembered per device. `allowed(choice)` may tidy a stored
 * value that no longer makes sense; nothing here is sent to the server.
 */
export default function useChartChoice(card, fallback) {
	const [choice, setChoice] = useState(() => ({ ...fallback, ...(read()[card] || {}) }));
	const update = useCallback(
		(patch) => {
			setChoice((cur) => {
				const next = { ...cur, ...patch };
				try {
					window.localStorage.setItem(KEY, JSON.stringify({ ...read(), [card]: next }));
				} catch {
					/* not remembered */
				}
				return next;
			});
		},
		[card]
	);
	return [choice, update];
}
