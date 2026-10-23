import { useCallback, useMemo, useReducer } from 'react';

/**
 * The slides of a deck with undo and redo. Every edit goes through `commit(next, key)`. Edits that share a key and
 * arrive within a second of each other (dragging, typing, a slider) merge into one history step, so Undo undoes the
 * whole gesture and not one pixel of it.
 */
const LIMIT = 80;
const MERGE_MS = 900;

function reducer(state, a) {
	switch (a.type) {
		case 'commit': {
			if (a.slides === state.slides) return state;
			const merge = a.key && state.key === a.key && a.at - state.at < MERGE_MS;
			return { slides: a.slides, past: merge ? state.past : [...state.past, state.slides].slice(-LIMIT), future: [], key: a.key || null, at: a.at, changes: state.changes + 1 };
		}
		case 'undo':
			return state.past.length ? { slides: state.past[state.past.length - 1], past: state.past.slice(0, -1), future: [state.slides, ...state.future], key: null, at: 0, changes: state.changes + 1 } : state;
		case 'redo':
			return state.future.length ? { slides: state.future[0], past: [...state.past, state.slides], future: state.future.slice(1), key: null, at: 0, changes: state.changes + 1 } : state;
		case 'reset':
			return { slides: a.slides, past: [], future: [], key: null, at: 0, changes: 0 };
		default:
			return state;
	}
}

export default function useDeckHistory(initial = []) {
	const [state, dispatch] = useReducer(reducer, { slides: initial, past: [], future: [], key: null, at: 0, changes: 0 });
	const commit = useCallback((slides, key) => dispatch({ type: 'commit', slides, key, at: Date.now() }), []);
	const undo = useCallback(() => dispatch({ type: 'undo' }), []);
	const redo = useCallback(() => dispatch({ type: 'redo' }), []);
	const reset = useCallback((slides) => dispatch({ type: 'reset', slides }), []);
	return useMemo(() => ({ slides: state.slides, commit, undo, redo, reset, canUndo: state.past.length > 0, canRedo: state.future.length > 0, changes: state.changes }), [state, commit, undo, redo, reset]);
}
