import { useCallback, useMemo, useState } from 'react';
import { sameTree } from './treeModel';

const LIMIT = 100;

/**
 * Local edit state for the reporting tree: undo/redo over immutable snapshots, plus a saved
 * baseline so the page knows when there is something to save. Nothing here touches the network.
 */
export default function useTreeHistory() {
	const [state, setState] = useState({ past: [], present: {}, future: [], saved: {}, lastKey: null });

	const load = useCallback((tree) => setState({ past: [], present: tree, future: [], saved: tree, lastKey: null }), []);
	// `key` coalesces consecutive edits of the same thing (typing a role label) into one undo step.
	const apply = useCallback((fn, key = null) => setState((s) => {
		const next = fn(s.present);
		if (next === s.present) return s;
		if (key && s.lastKey === key) return { ...s, present: next, future: [] };
		return { ...s, past: [...s.past.slice(-(LIMIT - 1)), s.present], present: next, future: [], lastKey: key };
	}), []);
	const undo = useCallback(() => setState((s) => (s.past.length ? { ...s, past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future], lastKey: null } : s)), []);
	const redo = useCallback(() => setState((s) => (s.future.length ? { ...s, past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1), lastKey: null } : s)), []);
	const markSaved = useCallback((tree) => setState((s) => ({ ...s, saved: tree })), []);

	const dirty = useMemo(() => !sameTree(state.present, state.saved), [state.present, state.saved]);
	return { tree: state.present, dirty, canUndo: state.past.length > 0, canRedo: state.future.length > 0, load, apply, undo, redo, markSaved };
}
