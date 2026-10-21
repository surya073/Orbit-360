import React from 'react';

/** A small segmented control to pick how a chart is drawn. options: [{ id, label }]. */
export default function ChartSwitch({ options, value, onChange, label = 'Chart type' }) {
	return (
		<div className="chart-switch" role="group" aria-label={label}>
			{options.map((o) => (
				<button key={o.id} type="button" className={`chart-switch__btn ${o.id === value ? 'is-on' : ''}`.trim()} aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
					{o.label}
				</button>
			))}
		</div>
	);
}
