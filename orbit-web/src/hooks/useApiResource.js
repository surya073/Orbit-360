import { useCallback, useEffect, useRef, useState } from 'react';
import { clearApiCache } from '../services/apiClient';

/**
 * Loads data with explicit state: 'loading' | 'success' | 'empty' | 'error'.
 * `fetcher(signal)` must resolve to { data, meta }. The request re-runs when `key`
 * changes (use a stable string, e.g. JSON.stringify(params)); stale responses are aborted.
 */
export default function useApiResource(fetcher, key, { enabled = true, isEmpty } = {}) {
	const [state, setState] = useState({ status: enabled ? 'loading' : 'idle', data: null, meta: null, error: null });
	const fetcherRef = useRef(fetcher);
	fetcherRef.current = fetcher;
	const [tick, setTick] = useState(0);

	useEffect(() => {
		if (!enabled) return undefined;
		const controller = new AbortController();
		setState((s) => ({ ...s, status: 'loading', error: null }));
		fetcherRef
			.current(controller.signal)
			.then(({ data, meta }) => {
				if (controller.signal.aborted) return;
				const empty = isEmpty ? isEmpty(data) : Array.isArray(data) && data.length === 0;
				setState({ status: empty ? 'empty' : 'success', data, meta, error: null });
			})
			.catch((error) => {
				if (controller.signal.aborted || (error && error.name === 'AbortError')) return;
				setState({ status: 'error', data: null, meta: null, error });
			});
		return () => controller.abort();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key, enabled, tick]);

	// Reload is an explicit request for fresh data, so it bypasses the short read cache.
	const reload = useCallback(() => {
		clearApiCache();
		setTick((t) => t + 1);
	}, []);
	return { ...state, reload };
}
