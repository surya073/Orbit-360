import React from 'react';
import { PERIOD_PRESETS, resolvePeriod } from '../../utils/periods';
import Field from '../forms/Field';

/**
 * Reporting-period picker (Asia/Kolkata business dates). `value` = { preset, from?, to? };
 * presets resolve to concrete dates only when used (rolling), custom keeps explicit dates.
 * An invalid custom range is flagged and not propagated (to < from is never emitted).
 */
export default function DateRangeFilter({ value, onChange, label = 'Period' }) {
	const resolved = resolvePeriod(value);
	const invalid = value.preset === 'custom' && value.from && value.to && value.to < value.from;

	const setPreset = (preset) => {
		if (preset === 'custom') onChange({ preset, from: resolved.from, to: resolved.to });
		else onChange({ preset });
	};
	const setDate = (key) => (e) => {
		const next = { ...value, preset: 'custom', [key]: e.target.value };
		onChange(next);
	};

	return (
		<>
			<Field label={label}>
				{(p) => (
					<select {...p} value={value.preset} onChange={(e) => setPreset(e.target.value)}>
						{PERIOD_PRESETS.map((o) => (
							<option key={o.id} value={o.id}>
								{o.label}
							</option>
						))}
					</select>
				)}
			</Field>
			{value.preset === 'custom' ? (
				<>
					<Field label="From">{(p) => <input {...p} type="date" value={value.from || ''} max={value.to || undefined} onChange={setDate('from')} />}</Field>
					<Field label="To" error={invalid ? 'End date is before the start date' : undefined}>
						{(p) => <input {...p} type="date" value={value.to || ''} min={value.from || undefined} onChange={setDate('to')} />}
					</Field>
				</>
			) : (
				<span className="chip" aria-label="Resolved dates">
					{resolved.from} → {resolved.to}
				</span>
			)}
		</>
	);
}

/** True when a period can be used for a request. */
export const isValidPeriod = (p) => p.preset !== 'custom' || Boolean(p.from && p.to && p.to >= p.from);
