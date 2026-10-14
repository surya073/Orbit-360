import React, { useId } from 'react';
import Icon from './Icon';

/** Accessible tab list (arrow keys, roving tabindex). Panels are rendered by the caller. */
export default function Tabs({ tabs, value, onChange, label, orientation = 'horizontal' }) {
	const vertical = orientation === 'vertical';
	const base = useId();
	const move = (e, i) => {
		const [nextKey, prevKey] = vertical ? ['ArrowDown', 'ArrowUp'] : ['ArrowRight', 'ArrowLeft'];
		const dir = e.key === nextKey ? 1 : e.key === prevKey ? -1 : 0;
		if (!dir) return;
		e.preventDefault();
		const next = tabs[(i + dir + tabs.length) % tabs.length];
		onChange(next.id);
		document.getElementById(`${base}-${next.id}`).focus();
	};
	return (
		<div className={`tabs ${vertical ? 'tabs--vertical' : ''}`.trim()} role="tablist" aria-label={label} aria-orientation={orientation}>
			{tabs.map((t, i) => (
				<button key={t.id} id={`${base}-${t.id}`} role="tab" type="button" className="tab" aria-selected={value === t.id} tabIndex={value === t.id ? 0 : -1} onClick={() => onChange(t.id)} onKeyDown={(e) => move(e, i)}>
					{t.icon ? <Icon name={t.icon} size={16} /> : null}
					<span>{t.label}</span>
				</button>
			))}
		</div>
	);
}
