import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext({ notify: () => {} });

/** Short, polite confirmations for completed actions (aria-live). Errors persist a little longer. */
export function ToastProvider({ children }) {
	const [items, setItems] = useState([]);
	const seq = useRef(0);
	const notify = useCallback((message, tone = 'info') => {
		const id = ++seq.current;
		setItems((l) => [...l.slice(-3), { id, message, tone }]);
		setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), tone === 'error' ? 7000 : 3500);
	}, []);
	const value = useMemo(() => ({ notify }), [notify]);
	return (
		<ToastContext.Provider value={value}>
			{children}
			<div className="toasts" aria-live="polite" aria-atomic="false">
				{items.map((t) => (
					<div key={t.id} className={`toast ${t.tone === 'error' ? 'toast--error' : ''}`} role={t.tone === 'error' ? 'alert' : 'status'}>
						{t.message}
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}

export const useToast = () => useContext(ToastContext);
