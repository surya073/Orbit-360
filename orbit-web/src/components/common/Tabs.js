import React, { useId } from 'react';

/** Accessible tab list (arrow keys, roving tabindex). Panels are rendered by the caller. */
export default function Tabs({ tabs, value, onChange, label }) {
	const base = useId();
	const move = (e, i) => {
		const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
		if (!dir) return;
		e.preventDefault();
		const next = tabs[(i + dir + tabs.length) % tabs.length];
		onChange(next.id);
		document.getElementById(`${base}-${next.id}`).focus();
	};
	return (
		<div className="tabs" role="tablist" aria-label={label}>
			{tabs.map((t, i) => (
				<button key={t.id} id={`${base}-${t.id}`} role="tab" type="button" className="tab" aria-selected={value === t.id} tabIndex={value === t.id ? 0 : -1} onClick={() => onChange(t.id)} onKeyDown={(e) => move(e, i)}>
					{t.label}
				</button>
			))}
		</div>
	);
}
