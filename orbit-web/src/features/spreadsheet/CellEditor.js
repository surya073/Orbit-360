import React, { useRef, useState } from 'react';
import LookupSelect from '../../components/forms/LookupSelect';
import { humanize } from '../../utils/format';

/**
 * In-cell editor. Text-like columns get an input, enum/boolean columns a native select, foreign
 * keys the existing server-searchable LookupSelect. Enter commits and moves down, Tab commits and
 * moves right, Escape cancels, leaving the cell commits. Keys are stopped here so the grid's
 * navigation shortcuts never fire while a value is being edited.
 */
export default function CellEditor({ col, initial, onCommit, onCancel }) {
	const [draft, setDraft] = useState(initial);
	const done = useRef(false);
	const finish = (text, nav) => {
		if (done.current) return;
		done.current = true;
		onCommit(text, nav);
	};
	const cancel = () => {
		if (done.current) return;
		done.current = true;
		onCancel();
	};
	const onKeyDown = (e, value) => {
		e.stopPropagation();
		if (e.key === 'Enter') {
			e.preventDefault();
			finish(value, 'down');
		} else if (e.key === 'Tab') {
			e.preventDefault();
			finish(value, e.shiftKey ? 'left' : 'right');
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancel();
		}
	};

	if (col.fk) {
		return (
			<div
				className="sheet-editor sheet-editor--fk"
				onKeyDown={(e) => {
					if (e.key === 'Escape') {
						e.stopPropagation();
						cancel();
					} else e.stopPropagation();
				}}
				onBlur={(e) => {
					if (!e.currentTarget.contains(e.relatedTarget)) cancel();
				}}
			>
				<LookupSelect column={col.field} value={initial} onChange={(v) => finish(v, 'down')} controlProps={{ autoFocus: true, 'aria-label': col.label }} />
			</div>
		);
	}

	if (col.type === 'enum' || col.type === 'bool') {
		const options = col.type === 'bool' ? [['true', 'Yes'], ['false', 'No']] : col.values.map((v) => [v, humanize(v)]);
		return (
			<select
				className="sheet-editor"
				aria-label={col.label}
				autoFocus
				value={draft}
				onChange={(e) => finish(e.target.value, 'down')}
				onKeyDown={(e) => onKeyDown(e, draft)}
				onBlur={cancel}
			>
				<option value="">{col.required ? 'Select…' : '(blank)'}</option>
				{options.map(([v, label]) => (
					<option key={v} value={v}>
						{label}
					</option>
				))}
			</select>
		);
	}

	return (
		<input
			className="sheet-editor"
			aria-label={col.label}
			autoFocus
			value={draft}
			maxLength={col.maxLength}
			inputMode={col.type === 'int' || col.type === 'num' ? 'decimal' : undefined}
			placeholder={col.type === 'date' ? 'YYYY-MM-DD' : col.type === 'datetime' ? 'YYYY-MM-DD HH:mm:ss' : undefined}
			onFocus={(e) => {
				const n = e.target.value.length;
				e.target.setSelectionRange(n, n);
			}}
			onChange={(e) => setDraft(e.target.value.replace(/[\r\n]+/g, ' '))}
			onKeyDown={(e) => onKeyDown(e, draft)}
			onBlur={() => finish(draft, null)}
		/>
	);
}
