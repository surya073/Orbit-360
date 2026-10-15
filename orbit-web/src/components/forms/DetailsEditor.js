import React, { useState } from 'react';
import Button, { IconButton } from '../common/Button';

const SIMPLE = ['string', 'number', 'boolean'];

/** Reads a saved JSON object into editable rows. Anything that is not a flat name/value list is left alone ("advanced"). */
export function parseDetails(value) {
	if (!value) return { rows: [], advanced: false };
	try {
		const o = JSON.parse(value);
		if (o && typeof o === 'object' && !Array.isArray(o) && Object.values(o).every((v) => SIMPLE.includes(typeof v))) {
			return { rows: Object.entries(o).map(([name, v]) => ({ name, value: String(v), orig: v })), advanced: false };
		}
	} catch {
		/* not JSON: treated as advanced below */
	}
	return { rows: [], advanced: true };
}

/** Rows -> the stored JSON text. Unchanged values keep their original type (a number stays a number); blank names are ignored. */
export function serializeDetails(rows) {
	const out = {};
	for (const r of rows) {
		const name = r.name.trim();
		if (!name) continue;
		out[name] = r.orig !== undefined && String(r.orig) === r.value ? r.orig : r.value;
	}
	return Object.keys(out).length ? JSON.stringify(out) : '';
}

/**
 * "Extra details": a plain list of Name / Value pairs for information that has no field of its own,
 * so nobody has to write JSON. The form still stores the same JSON text underneath.
 */
export default function DetailsEditor({ id, value, onChange, disabled, label = 'Extra details' }) {
	const [state, setState] = useState(() => parseDetails(value));
	const { rows, advanced } = state;

	if (advanced) {
		return (
			<p id={id} className="small muted">
				This record has detailed extra information that is not shown as a simple list. It is kept exactly as it is.
			</p>
		);
	}

	const update = (next) => {
		setState({ rows: next, advanced: false });
		onChange(serializeDetails(next));
	};
	const edit = (i, patch) => update(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

	return (
		<div id={id} role="group" aria-label={label} className="details-editor">
			{rows.length === 0 ? <p className="small muted">None added. Use this for anything that has no field of its own, for example Desk → B-12.</p> : null}
			{rows.map((r, i) => (
				<div className="details-editor__row" key={i}>
					<input aria-label={`Detail ${i + 1} name`} placeholder="Name (e.g. Desk)" value={r.name} maxLength={60} disabled={disabled} onChange={(e) => edit(i, { name: e.target.value })} />
					<input aria-label={`Detail ${i + 1} value`} placeholder="Value (e.g. B-12)" value={r.value} maxLength={200} disabled={disabled} onChange={(e) => edit(i, { value: e.target.value })} />
					<IconButton icon="trash" label={`Remove detail ${i + 1}`} disabled={disabled} onClick={() => update(rows.filter((_, j) => j !== i))} />
				</div>
			))}
			<div>
				<Button size="sm" icon="plus" disabled={disabled || rows.length >= 20} onClick={() => update([...rows, { name: '', value: '' }])}>
					Add a detail
				</Button>
			</div>
		</div>
	);
}
