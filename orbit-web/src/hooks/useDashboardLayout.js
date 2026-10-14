import { useCallback, useMemo, useState } from 'react';
import { DASHBOARD_LAYOUT_KEY, DEFAULT_ORDER, normalizeLayout } from '../config/dashboardLayout';

export function readLayout(storage = window.localStorage) {
	try {
		return normalizeLayout(JSON.parse(storage.getItem(DASHBOARD_LAYOUT_KEY) || '{}'));
	} catch {
		return normalizeLayout(null);
	}
}

/** Dashboard widget order + visibility, persisted per device. Storage failures degrade to session-only. */
export default function useDashboardLayout() {
	const [layout, setLayout] = useState(readLayout);

	const commit = useCallback((next) => {
		const clean = normalizeLayout(next);
		setLayout(clean);
		try {
			window.localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(clean));
		} catch {
			/* storage unavailable: applies for this session only */
		}
	}, []);

	return useMemo(
		() => ({
			order: layout.order,
			hidden: layout.hidden,
			visible: layout.order.filter((id) => !layout.hidden.includes(id)),
			isDefault: layout.hidden.length === 0 && layout.order.every((id, i) => id === DEFAULT_ORDER[i]),
			setOrder: (order) => commit({ order, hidden: layout.hidden }),
			setVisible: (id, shown) => commit({ order: layout.order, hidden: shown ? layout.hidden.filter((h) => h !== id) : [...layout.hidden, id] }),
			reset: () => commit(null),
		}),
		[layout, commit]
	);
}
