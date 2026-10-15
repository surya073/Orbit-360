import React, { useState } from 'react';
import { useAuth } from '../../app/providers/AuthProvider';
import Card from '../../components/cards/Card';
import Button from '../../components/common/Button';
import StateView from '../../components/feedback/StateView';
import { useToast } from '../../components/feedback/ToastProvider';
import Field from '../../components/forms/Field';
import DataTable from '../../components/tables/DataTable';
import Pagination from '../../components/tables/Pagination';
import useClientPagination from '../../hooks/useClientPagination';
import useApiResource from '../../hooks/useApiResource';
import { settingsService } from '../../services/settingsService';

const EMPTY_FORM = { setting_key: '', setting_value: '', value_type: 'string', description: '' };

/** Global configuration key/values. Everyone can read; only administrators can change. */
export default function ApplicationSettings() {
	const { user } = useAuth();
	const isAdmin = user.role === 'admin';
	const { notify } = useToast();
	const res = useApiResource((signal) => settingsService.list({ signal }), 'settings');
	const paged = useClientPagination(res.data || [], 'settings', 10);
	const [form, setForm] = useState(EMPTY_FORM);
	const [errors, setErrors] = useState({});
	const [saving, setSaving] = useState(false);
	const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

	const save = async (e) => {
		e.preventDefault();
		setSaving(true);
		setErrors({});
		const body = { scope: 'global' };
		Object.entries(form).forEach(([k, v]) => {
			if (v !== '') body[k] = v;
		});
		try {
			await settingsService.upsert(body);
			setForm(EMPTY_FORM);
			notify('Setting saved');
			res.reload();
		} catch (err) {
			setErrors(err.fieldErrors || {});
			notify(err.message, 'error');
		}
		setSaving(false);
	};

	return (
		<div className="stack">
			<Card title="Application settings" subtitle={isAdmin ? 'Global values used across the application' : 'Read-only. Administrators can change these.'}>
				<StateView res={res} emptyTitle="No settings defined" emptyMessage="No application settings have been created yet." loadingLines={3}>
					{res.data ? (
						<>
						<DataTable
							caption="Application settings"
							columns={[
								{ key: 'setting_key', label: 'Key' },
								{ key: 'scope', label: 'Scope' },
								{ key: 'setting_value', label: 'Value' },
								{ key: 'value_type', label: 'Type' },
							]}
							rows={paged.rows}
							rowActions={isAdmin ? (row) => (row.scope === 'global' ? <Button size="sm" icon="edit" onClick={() => setForm({ setting_key: row.setting_key, setting_value: row.setting_value || '', value_type: row.value_type || 'string', description: row.description || '' })}>Edit</Button> : null) : undefined}
						/>
						<Pagination {...paged.pagination} />
						</>
					) : null}
				</StateView>
			</Card>
			{isAdmin ? (
				<Card title="Add or update a global setting">
					<form onSubmit={save} noValidate>
						<div className="form-grid">
							<Field label="Key" required error={errors.setting_key} hint="lowercase letters, digits, . and _">
								{(p) => <input {...p} value={form.setting_key} onChange={set('setting_key')} maxLength={100} />}
							</Field>
							<Field label="Value" error={errors.setting_value}>
								{(p) => <input {...p} value={form.setting_value} onChange={set('setting_value')} />}
							</Field>
							<Field label="Type">
								{(p) => (
									<select {...p} value={form.value_type} onChange={set('value_type')}>
										{['string', 'number', 'boolean', 'json'].map((t) => (
											<option key={t} value={t}>
												{t}
											</option>
										))}
									</select>
								)}
							</Field>
							<Field label="Description" error={errors.description}>
								{(p) => <input {...p} value={form.description} onChange={set('description')} />}
							</Field>
						</div>
						<div style={{ marginTop: 'var(--space-3)' }}>
							<Button variant="primary" type="submit" loading={saving} disabled={!form.setting_key}>
								Save setting
							</Button>
						</div>
					</form>
				</Card>
			) : null}
		</div>
	);
}
