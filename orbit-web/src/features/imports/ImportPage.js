import React, { useMemo, useRef, useState } from 'react';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import StateView from '../../components/feedback/StateView';
import TeamFilter from '../../components/filters/TeamFilter';
import Field from '../../components/forms/Field';
import PageHeader from '../../components/layout/PageHeader';
import DataTable from '../../components/tables/DataTable';
import Pagination from '../../components/tables/Pagination';
import useClientPagination from '../../hooks/useClientPagination';
import features from '../../config/features';
import DataEntryModes from '../spreadsheet/DataEntryModes';
import useTemplates from '../../hooks/useTemplates';
import { importsService } from '../../services/importsService';
import { csvToRecords, toCsv } from '../../utils/csv';
import { humanize } from '../../utils/format';

const MAX_ROWS = 5000; // client-side cap; the server accepts at most one batch per call
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const chunk = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, (i + 1) * n));

async function sha256Hex(buffer) {
	try {
		const digest = await window.crypto.subtle.digest('SHA-256', buffer);
		return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
	} catch {
		return null; // optional: only used to warn about re-uploads
	}
}

const columnsOf = (template) => [...template.columns.map((c) => c.field), ...(template.importColumns || ['source_record_id'])];

function downloadTemplate(template) {
	const blob = new Blob([toCsv([columnsOf(template)])], { type: 'text/csv' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${template.module}_template.csv`;
	a.click();
	URL.revokeObjectURL(url);
}

const countBy = (results) => {
	const c = {};
	results.forEach((r) => {
		c[r.status] = (c[r.status] || 0) + 1;
	});
	return c;
};

const STEPS = ['Choose file', 'Review', 'Import'];

/**
 * CSV import. Rows are validated by the server in bounded batches and nothing is saved until
 * "Import valid rows". Re-sending a batch never creates duplicates (the server is idempotent).
 */
export default function ImportPage() {
	const templates = useTemplates();
	const [module, setModule] = useState('');
	const [policy, setPolicy] = useState('ask');
	const [team, setTeam] = useState(''); // admins only; managers are pinned by the server
	const [phase, setPhase] = useState('idle'); // idle | working | previewed | committed | error
	const [message, setMessage] = useState(null); // { text, error }
	const [progress, setProgress] = useState(null);
	const [job, setJob] = useState(null);
	const [records, setRecords] = useState([]);
	const [results, setResults] = useState({}); // rowNumber -> latest server result
	const [choices, setChoices] = useState({}); // rowNumber -> resolution
	const [unmapped, setUnmapped] = useState([]);
	const [final, setFinal] = useState(null);
	const running = useRef(false);
	const hasPreview = useRef(false);

	// Only record types this user may create (an import adds records; the backend checks again).
	const importable = (templates.data || []).filter((t) => t.importable && (!t.permissions || t.permissions.create));
	const template = importable.find((t) => t.module === module);
	const list = useMemo(() => Object.values(results).sort((a, b) => a.rowNumber - b.rowNumber), [results]);
	const counts = countBy(list);
	const conflicts = list.filter((r) => r.status === 'conflict');
	const problems = list.filter((r) => r.status === 'invalid' || r.status === 'failed');
	const conflictPage = useClientPagination(conflicts, 'import-conflicts', 10);
	const problemPage = useClientPagination(problems, 'import-problems', 10);
	const step = phase === 'committed' ? 2 : list.length ? 1 : 0;

	const merge = (rows) => {
		hasPreview.current = true;
		setResults((prev) => ({ ...prev, ...Object.fromEntries(rows.map((r) => [r.rowNumber, r])) }));
	};
	const dataOf = (n) => records.find((r) => r.rowNumber === n);

	async function inBatches(rows, size, label, fn) {
		const batches = chunk(rows, size);
		for (let i = 0; i < batches.length; i++) {
			setProgress(`${label}: batch ${i + 1} of ${batches.length}`);
			await fn(batches[i]);
		}
		setProgress(null);
	}

	const guard = async (fn) => {
		if (running.current) return;
		running.current = true;
		setPhase('working');
		setMessage(null);
		try {
			await fn();
		} catch (err) {
			setMessage({ text: err.message, error: true });
			// Keep the preview usable so a failed commit can be retried (it is idempotent).
			setPhase(hasPreview.current ? 'previewed' : 'error');
			setProgress(null);
		} finally {
			running.current = false;
		}
	};

	const reset = () => {
		hasPreview.current = false;
		setPhase('idle');
		setJob(null);
		setResults({});
		setChoices({});
		setFinal(null);
		setRecords([]);
	};

	const onFile = (e) => {
		const file = e.target.files[0];
		e.target.value = '';
		if (!file || !template) return;
		guard(async () => {
			if (!/\.csv$/i.test(file.name)) throw new Error('Only .csv files are supported. Excel (.xlsx) import is not available yet.');
			if (file.size > MAX_FILE_BYTES) throw new Error('File is larger than 2 MB.');
			const text = await file.text();
			const parsed = csvToRecords(text, columnsOf(template));
			if (parsed.records.length > MAX_ROWS) throw new Error(`The file has ${parsed.records.length} rows; at most ${MAX_ROWS} can be imported at once.`);
			const rows = parsed.records.map((data, i) => ({ rowNumber: i + 1, data }));
			setRecords(rows);
			setUnmapped(parsed.unmapped);
			setResults({});
			setChoices({});
			setFinal(null);
			hasPreview.current = false;
			const sha = await sha256Hex(await file.arrayBuffer());
			const { data: created } = await importsService.createJob({ module, fileName: file.name, fileType: 'csv', totalRows: rows.length, conflictPolicy: policy, ...(team ? { teamId: team } : {}), ...(sha ? { fileSha256: sha } : {}) });
			setJob(created);
			if (created.possibleDuplicateOfJobs.length) setMessage({ text: 'This exact file was uploaded before for this team. Check that you are not importing it twice.' });
			await inBatches(rows, created.batchSize, 'Validating', async (batch) => {
				const { data } = await importsService.preview(created.id, batch);
				merge(data.rows);
			});
			setPhase('previewed');
		});
	};

	const saveChoices = () =>
		guard(async () => {
			const entries = Object.entries(choices).map(([rowNumber, resolution]) => ({ rowNumber: Number(rowNumber), resolution }));
			await inBatches(entries, job.batchSize, 'Saving choices', async (batch) => {
				await importsService.resolve(job.id, batch);
			});
			setResults((prev) => {
				const next = { ...prev };
				entries.forEach((e) => {
					if (next[e.rowNumber]) next[e.rowNumber] = { ...next[e.rowNumber], conflict: { ...next[e.rowNumber].conflict, resolution: e.resolution } };
				});
				return next;
			});
			setPhase('previewed');
			setMessage({ text: 'Choices saved.' });
		});

	const commit = () =>
		guard(async () => {
			const toSend = list.filter((r) => ['valid', 'conflict', 'failed'].includes(r.status)).map((r) => dataOf(r.rowNumber));
			await inBatches(toSend, job.batchSize, 'Importing', async (batch) => {
				const { data } = await importsService.commit(job.id, batch);
				merge(data.rows);
			});
			const { data } = await importsService.complete(job.id);
			setFinal(data);
			setPhase('committed');
		});

	const cancel = () =>
		guard(async () => {
			await importsService.cancel(job.id);
			reset();
			setMessage({ text: 'Import cancelled. Nothing further will be written.' });
		});

	const busy = phase === 'working';
	const locked = busy || phase === 'previewed' || phase === 'committed';
	const canCommit = phase === 'previewed' && (counts.valid || 0) + (counts.conflict || 0) + (counts.failed || 0) > 0;

	return (
		<>
			<PageHeader title="Import data" description="Upload a CSV, review what will happen, then import. Nothing is saved until you confirm." />
			<DataEntryModes current="import" resource={module || undefined} />
			<ol className="tabs" aria-label="Progress" style={{ borderBottom: 0, marginBottom: 'var(--space-3)' }}>
				{STEPS.map((s, i) => (
					<li key={s} className="small" style={{ padding: '4px 12px 4px 0', fontWeight: i === step ? 700 : 500, color: i <= step ? 'var(--text)' : 'var(--text-muted)' }} aria-current={i === step ? 'step' : undefined}>
						{i + 1}. {s}
					</li>
				))}
			</ol>

			<StateView res={templates} loadingLines={2}>
				<div className="filter-bar">
					<Field label="Data type">
						{(p) => (
							<select {...p} value={module} disabled={locked} onChange={(e) => setModule(e.target.value)}>
								<option value="">Select…</option>
								{importable.map((t) => (
									<option key={t.module} value={t.module}>
										{humanize(t.module)}
									</option>
								))}
							</select>
						)}
					</Field>
					<Field label="If a record already exists">
						{(p) => (
							<select {...p} value={policy} disabled={locked} onChange={(e) => setPolicy(e.target.value)}>
								<option value="ask">Ask me for each one</option>
								<option value="update">Update the existing record</option>
								<option value="keep_existing">Keep the existing record</option>
								<option value="skip">Skip the row</option>
							</select>
						)}
					</Field>
					<TeamFilter value={team} onChange={setTeam} />
					<Field label="CSV file" hint="Headers must match the template. Max 2 MB.">
						{(p) => <input {...p} type="file" accept=".csv,text/csv" disabled={!template || locked} onChange={onFile} />}
					</Field>
					<Button icon="download" disabled={!template} onClick={() => downloadTemplate(template)}>
						Download template
					</Button>
				</div>
				{!features.excelImport ? <p className="small muted">CSV files only. Excel (.xlsx) import needs a spreadsheet parser that has not been added yet. Rows can refer to people and projects by employee_code and project_code.</p> : null}
			</StateView>

			<div aria-live="polite">
				{progress ? (
					<p role="status" className="banner banner--info">
						<span className="spinner" aria-hidden="true" /> {progress}…
					</p>
				) : null}
				{message ? (
					<p role={message.error ? 'alert' : 'status'} className={`banner ${message.error ? 'banner--error' : 'banner--info'}`}>
						{message.text}
					</p>
				) : null}
			</div>

			{list.length ? (
				<section aria-label="Validation result" className="stack" style={{ marginTop: 'var(--space-4)' }}>
					<div className="legend" style={{ marginTop: 0 }}>
						<span>{records.length} rows</span>
						<StatusBadge tone="info" status="valid" label={`${(counts.valid || 0) + (counts.committed || 0)} ready or imported`} />
						<StatusBadge tone="warning" status="conflict" label={`${counts.conflict || 0} already exist`} />
						<StatusBadge tone="danger" status="invalid" label={`${counts.invalid || 0} invalid`} />
						{counts.failed ? <StatusBadge tone="danger" status="failed" label={`${counts.failed} failed (safe to retry)`} /> : null}
						{counts.skipped ? <StatusBadge status="skipped" label={`${counts.skipped} skipped`} /> : null}
					</div>
					{unmapped.length ? <p className="banner banner--warning">Ignored columns (no matching field): {unmapped.join(', ')}</p> : null}
					<p className="small muted">Checked: types, required fields, allowed values, team access, duplicates and existing records. Rows are matched by a stable key, so importing the same file twice never creates duplicates.</p>

					{conflicts.length ? (
						<div>
							<h2 className="section-title" style={{ marginTop: 0 }}>Records that already exist</h2>
							<DataTable
								caption="Conflicts"
								rowKey="rowNumber"
								columns={[
									{ key: 'rowNumber', label: 'Row' },
									{
										key: 'choice',
										label: 'What to do',
										render: (r) => (
											<select className="input" style={{ width: 'auto' }} aria-label={`Resolution for row ${r.rowNumber}`} value={choices[r.rowNumber] || (r.conflict && r.conflict.resolution) || ''} disabled={busy || phase !== 'previewed'} onChange={(e) => setChoices((c) => ({ ...c, [r.rowNumber]: e.target.value }))}>
												<option value="">Use the default above</option>
												<option value="update">Update existing</option>
												<option value="keep_existing">Keep existing</option>
												<option value="skip">Skip</option>
											</select>
										),
									},
								]}
								rows={conflictPage.rows}
							/>
							<Pagination {...conflictPage.pagination} />
							<div style={{ marginTop: 8 }}>
								<Button disabled={busy || phase !== 'previewed' || Object.keys(choices).length === 0} onClick={saveChoices}>
									Save choices
								</Button>
							</div>
						</div>
					) : null}

					{problems.length ? (
						<div>
							<h2 className="section-title" style={{ marginTop: 0 }}>Rows with problems</h2>
							<DataTable caption="Rows with problems" rowKey="rowNumber" columns={[{ key: 'rowNumber', label: 'Row' }, { key: 'errors', label: 'Problems', render: (r) => r.errors.map((e) => `${e.field ? `${e.field}: ` : ''}${e.message}`).join('; ') }]} rows={problemPage.rows} />
							<Pagination {...problemPage.pagination} />
						</div>
					) : null}

					{final ? (
						<p className={`banner ${final.status === 'completed' ? 'banner--success' : 'banner--warning'}`} role="status">
							{final.status === 'completed' ? 'Import completed' : 'Import finished with items needing attention'}: {final.counts.created} created, {final.counts.updated} updated, {final.counts.skipped} skipped, {final.counts.invalid} invalid, {final.counts.conflict} unresolved.
						</p>
					) : null}

					<div className="page-header__actions">
						{features.importCommit && phase !== 'committed' ? (
							<Button variant="primary" disabled={busy || !canCommit} onClick={commit}>
								Import valid rows
							</Button>
						) : null}
						{job && phase !== 'committed' ? (
							<Button disabled={busy} onClick={cancel}>
								Cancel import
							</Button>
						) : null}
						{phase === 'committed' ? <Button onClick={reset}>Start another import</Button> : null}
					</div>
				</section>
			) : null}
		</>
	);
}
