import React, { useState } from 'react';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { useToast } from '../../components/feedback/ToastProvider';
import Field from '../../components/forms/Field';
import Select from '../../components/forms/Select';
import { customFieldsService } from '../../services/customFieldsService';
import { keyFromLabel } from './gridModel';

const TYPE_LABELS = { text: 'Text', number: 'Number', date: 'Date', choice: 'Choice list' };

/**
 * Lists the extra columns of a record type and lets people with the custom_fields permissions add or remove them.
 * Removing a column hides it; the values already stored on records are kept.
 */
export default function CustomColumnsDialog({ resource, title, fields, canCreate, canDelete, onChanged, onClose }) {
	const { notify } = useToast();
	const [label, setLabel] = useState('');
	const [type, setType] = useState('text');
	const [choices, setChoices] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const add = async (e) => {
		e.preventDefault();
		setError('');
		if (!label.trim()) return setError('Give the column a name');
		if (type === 'choice' && !choices.split(',').some((c) => c.trim())) return setError('Add at least one choice, separated by commas');
		setBusy(true);
		try {
			const taken = fields.map((f) => f.field_key);
			await customFieldsService.create({
				module: resource,
				field_key: keyFromLabel(label, taken),
				label: label.trim(),
				field_type: type,
				...(type === 'choice' ? { choices: choices.split(',').map((c) => c.trim()).filter(Boolean).join(',') } : {}),
				sort_order: fields.length + 1,
				is_active: true,
			});
			notify(`Added column "${label.trim()}"`, 'success');
			setLabel('');
			setChoices('');
			setType('text');
			onChanged();
		} catch (err) {
			const fe = err.fieldErrors || {};
			setError(Object.values(fe)[0] || err.message || 'Could not add the column');
		} finally {
			setBusy(false);
		}
	};

	const remove = async (f) => {
		setBusy(true);
		try {
			await customFieldsService.remove(f.ROWID);
			notify(`Removed column "${f.label}". Values already saved on records are kept.`, 'success');
			onChanged();
		} catch (err) {
			notify(err.message || 'Could not remove the column', 'error');
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal title={`Extra columns: ${title}`} onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
			<div className="stack">
				<p className="small muted">Extra columns hold information this record type does not have a field for. They appear in the spreadsheet for everyone who can see these records.</p>
				{fields.length === 0 ? (
					<p className="small">No extra columns yet.</p>
				) : (
					<ul className="stack" aria-label="Existing extra columns">
						{fields.map((f) => (
							<li key={f.ROWID} className="colrow">
								<span>
									<b>{f.label}</b> <span className="muted small">· {TYPE_LABELS[f.field_type] || f.field_type}{f.field_type === 'choice' ? ` (${f.choices})` : ''}</span>
								</span>
								{canDelete ? (
									<Button size="sm" variant="ghost" onClick={() => remove(f)} disabled={busy} aria-label={`Remove column ${f.label}`}>
										Remove
									</Button>
								) : null}
							</li>
						))}
					</ul>
				)}
				{canCreate ? (
					<form className="stack" onSubmit={add} noValidate>
						<Field label="New column name" error={error && !label.trim() ? error : ''}>
							{(p) => <input {...p} className="input" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Client tier" />}
						</Field>
						<Field label="Type">
							{(p) => (
								<Select {...p} value={type} onChange={(e) => setType(e.target.value)}>
									{Object.entries(TYPE_LABELS).map(([v, l]) => (
										<option key={v} value={v}>
											{l}
										</option>
									))}
								</Select>
							)}
						</Field>
						{type === 'choice' ? (
							<Field label="Choices" hint="Separate with commas, e.g. Gold, Silver, Bronze">
								{(p) => <input {...p} className="input" value={choices} maxLength={500} onChange={(e) => setChoices(e.target.value)} />}
							</Field>
						) : null}
						{error && label.trim() ? (
							<p role="alert" className="field-error">
								{error}
							</p>
						) : null}
						<div>
							<Button type="submit" variant="primary" icon="plus" loading={busy}>
								Add column
							</Button>
						</div>
					</form>
				) : (
					<p className="small muted">Only administrators can add or remove extra columns.</p>
				)}
			</div>
		</Modal>
	);
}
