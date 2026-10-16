import React from 'react';

/**
 * A small set of mutually exclusive choices drawn as segmented buttons (ARIA radiogroup, arrow keys move).
 * options: [{ id, label, hint? }]. The hint of the selected option is read out below the control.
 */
export default function OptionGroup({ label, options, value, onChange }) {
	const i = options.findIndex((o) => o.id === value);
	const onKey = (e, idx) => {
		const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
		if (!dir) return;
		e.preventDefault();
		const next = options[(idx + dir + options.length) % options.length];
		onChange(next.id);
		const el = document.getElementById(`opt-${label}-${next.id}`);
		if (el) el.focus();
	};
	return (
		<div className="optgroup">
			<div className="optgroup__row" role="radiogroup" aria-label={label}>
				{options.map((o, idx) => (
					<button key={o.id} id={`opt-${label}-${o.id}`} type="button" role="radio" aria-checked={value === o.id} tabIndex={value === o.id ? 0 : -1} className="optgroup__btn" onClick={() => onChange(o.id)} onKeyDown={(e) => onKey(e, idx)}>
						{o.label}
					</button>
				))}
			</div>
			{i >= 0 && options[i].hint ? <p className="small muted optgroup__hint">{options[i].hint}</p> : null}
		</div>
	);
}
