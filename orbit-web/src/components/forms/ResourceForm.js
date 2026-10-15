import React, { useState } from 'react';
import { LOOKUPS } from '../../hooks/useLookup';
import { resourceService } from '../../services/resourceService';
import { humanize } from '../../utils/format';
import Button from '../common/Button';
import Field from './Field';
import LookupSelect from './LookupSelect';

// Friendlier labels where the column name is schema jargon.
const LABELS = { email_normalized: 'Email', source_record_id: 'Source record ID', work_description: 'Description', is_billable: 'Billable', late_status: 'Late status' };
const labelFor = (field) => LABELS[field] || humanize(field);

const toInput = (v) => (v === null || v === undefined ? '' : String(v));

/**
 * Builds a payload from form state: blank -> omitted (never 0 or ''), edits send only changed
 * fields, immutable fields are never re-sent on edit.
 */
export function buildPayload(columns, values, initial, immutable) {
	const out = {};
	for (const c of columns) {
		if (initial && immutable.includes(c.field)) continue;
		const v = values[c.field] ?? '';
		if (v === (initial ? toInput(initial[c.field]) : '')) continue;
		if (v === '') continue; // clearing a value is not supported by the API; blank means "not provided"
		out[c.field] = v;
	}
	return out;
}

/**
 * Create/edit form generated from a backend field contract (`template`). Validation is
 * server-authoritative: field errors from a 422 are shown beside the fields. `defaults` prefill a
 * create; `lockedFields` are shown but cannot be changed (e.g. the project of an assignment).
 */
export default function ResourceForm({ resource, template, initial, defaults = {}, lockedFields = [], onSaved, onCancel, formId = 'resource-form' }) {
	const [values, setValues] = useState(() => Object.fromEntries(template.columns.map((c) => [c.field, toInput(initial ? initial[c.field] : defaults[c.field])])));
	const [fieldErrors, setFieldErrors] = useState({});
	const [formError, setFormError] = useState(null);
	const [saving, setSaving] = useState(false);
	const editing = Boolean(initial);
	const set = (field) => (v) => setValues((s) => ({ ...s, [field]: v }));

	const submit = async (e) => {
		e.preventDefault();
		setSaving(true);
		setFormError(null);
		setFieldErrors({});
		const payload = { ...buildPayload(template.columns, values, initial, template.immutable) };
		for (const [k, v] of Object.entries(defaults)) if (!editing && payload[k] === undefined && v) payload[k] = String(v);
		try {
			if (editing && Object.keys(payload).length === 0) {
				setFormError('Nothing has changed.');
			} else {
				const out = editing ? await resourceService.update(resource, initial.ROWID, payload) : await resourceService.create(resource, payload);
				onSaved(out.data, editing);
				return;
			}
		} catch (error) {
			setFieldErrors(error.fieldErrors || {});
			setFormError(Object.keys(error.fieldErrors || {}).length ? 'Please fix the highlighted fields.' : error.message);
		}
		setSaving(false);
	};

	return (
		<form id={formId} onSubmit={submit} noValidate aria-label={editing ? 'Edit record' : 'New record'}>
			{formError ? (
				<p role="alert" className="banner banner--error">
					{formError}
				</p>
			) : null}
			<div className="form-grid">
				{template.columns.map((c) => {
					const locked = lockedFields.includes(c.field) || (editing && template.immutable.includes(c.field));
					const hint = c.type === 'datetime' ? 'YYYY-MM-DD HH:mm:ss (IST)' : c.field === 'more_details' ? 'Optional JSON object' : undefined;
					return (
						<Field key={c.field} label={labelFor(c.field)} required={c.required} error={fieldErrors[c.field]} hint={hint} className={c.type === 'text' || c.type === 'json' ? 'span-2' : ''}>
							{(p) => {
								const v = values[c.field];
								const on = (e) => set(c.field)(e.target.value);
								if (LOOKUPS[c.field]) return <LookupSelect column={c.field} value={v} onChange={set(c.field)} controlProps={p} disabled={locked} />;
								if (c.type === 'enum')
									return (
										<select {...p} value={v} onChange={on} disabled={locked}>
											<option value="">{c.required ? 'Select…' : '(not set)'}</option>
											{c.values.map((o) => (
												<option key={o} value={o}>
													{humanize(o)}
												</option>
											))}
										</select>
									);
								if (c.type === 'bool')
									return (
										<select {...p} value={v} onChange={on} disabled={locked}>
											<option value="">{c.required ? 'Select…' : '(not set)'}</option>
											<option value="true">Yes</option>
											<option value="false">No</option>
										</select>
									);
								if (c.type === 'text' || c.type === 'json') return <textarea {...p} rows={3} value={v} onChange={on} disabled={locked} />;
								const type = c.type === 'date' ? 'date' : c.type === 'int' || c.type === 'num' ? 'number' : 'text';
								return <input {...p} type={type} step={c.type === 'num' ? 'any' : undefined} maxLength={c.maxLength} value={v} onChange={on} disabled={locked} />;
							}}
						</Field>
					);
				})}
			</div>
			<div className="modal__foot modal__foot--sticky">
				<Button onClick={onCancel} disabled={saving}>
					Cancel
				</Button>
				<Button variant="primary" type="submit" loading={saving}>
					{editing ? 'Save changes' : 'Create'}
				</Button>
			</div>
		</form>
	);
}
