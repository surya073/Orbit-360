import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../common/Icon';

const ToastContext = createContext({ notify: () => {} });

// tone -> visual treatment. Plain confirmations ("Record created") are successes; 'info' is for
// neutral notes, 'warning' for things that need a look, 'error' for failures (announced assertively).
const TONES = {
	success: { title: 'Success', icon: 'check', ms: 4500 },
	info: { title: 'Note', icon: 'info', ms: 4500 },
	warning: { title: 'Heads up', icon: 'alert', ms: 7000 },
	error: { title: 'Something went wrong', icon: 'alert', ms: 9000 },
};
const LEAVE_MS = 220;
const MAX_VISIBLE = 4;

function Toast({ item, onDone }) {
	const t = TONES[item.tone] || TONES.success;
	const [leaving, setLeaving] = useState(false);
	const timer = useRef(null);
	const left = useRef(t.ms);
	const startedAt = useRef(0);

	const dismiss = useCallback(() => {
		clearTimeout(timer.current);
		setLeaving(true);
		setTimeout(() => onDone(item.id), LEAVE_MS);
	}, [item.id, onDone]);

	const start = useCallback(() => {
		startedAt.current = Date.now();
		timer.current = setTimeout(dismiss, left.current);
	}, [dismiss]);
	const pause = () => {
		clearTimeout(timer.current);
		left.current = Math.max(1200, left.current - (Date.now() - startedAt.current)); // never vanishes the instant the pointer leaves
	};

	useEffect(() => {
		start();
		return () => clearTimeout(timer.current);
	}, [start]);

	return (
		<div className={`toast toast--${item.tone} ${leaving ? 'is-leaving' : ''}`.trim()} role={item.tone === 'error' ? 'alert' : 'status'} onMouseEnter={pause} onMouseLeave={start} onFocus={pause} onBlur={start}>
			<span className="toast__icon" aria-hidden="true">
				<Icon name={t.icon} size={16} />
			</span>
			<div className="toast__text">
				<div className="toast__title">{item.title || t.title}</div>
				<div className="toast__msg">{item.message}</div>
			</div>
			<button type="button" className="toast__close" aria-label="Dismiss notification" onClick={dismiss}>
				<Icon name="x" size={14} />
			</button>
		</div>
	);
}

/**
 * Notifications for completed actions and problems. `notify(message, tone = 'success', { title })`.
 * Toasts pause while hovered or focused, can be dismissed, and respect reduced motion.
 */
export function ToastProvider({ children }) {
	const [items, setItems] = useState([]);
	const seq = useRef(0);
	const notify = useCallback((message, tone = 'success', opts = {}) => {
		const id = ++seq.current;
		const known = TONES[tone] ? tone : 'info';
		setItems((l) => [...l.slice(-(MAX_VISIBLE - 1)), { id, message, tone: known, title: opts.title }]);
	}, []);
	const remove = useCallback((id) => setItems((l) => l.filter((x) => x.id !== id)), []);
	const value = useMemo(() => ({ notify }), [notify]);
	return (
		<ToastContext.Provider value={value}>
			{children}
			<div className="toasts" aria-live="polite" aria-atomic="false">
				{items.map((t) => (
					<Toast key={t.id} item={t} onDone={remove} />
				))}
			</div>
		</ToastContext.Provider>
	);
}

export const useToast = () => useContext(ToastContext);
