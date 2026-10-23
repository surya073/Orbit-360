import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AiButton from '../../components/common/AiButton';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
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
import { duplicateTargets, readCsv, toCsv } from '../../utils/csv';
import { buildRecords, emptyColumns, EXTRA } from '../../utils/importPrep';
import { matchHeaders, rememberMapping, rememberedMapping } from '../../utils/headerMatch';
import { humanize } from '../../utils/format';
import Select from '../../components/forms/Select';

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
/** The same fields with their types, for the matcher (it reads the values to tell a date column from a name column). */
/** Every target a remembered mapping may name: the matchable fields plus more_details (where unmatched columns go). */
const knownOf = (template) => [...specsOf(template), { field: EXTRA, type: 'json', required: false }];
const hasDetails = (template) => template.columns.some((c) => c.field === EXTRA);
const specsOf = (template) => [...template.columns, ...(template.importColumns || ['source_record_id']).map((field) => ({ field, type: 'str', required: false }))].filter((c) => c.field !== 'more_details'); // raw JSON: never a guess for a notes column

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

/** Required fields of the template that no header is mapped to. */
const missingRequired = (template, mapping) => template.columns.filter((c) => c.required && !mapping.includes(c.field)).map((c) => c.field);

/**
 * Shown when a file's headers do not line up with the template: each header can be matched to a field or left out. Nothing
 * is sent anywhere until the user continues; the server still validates every row afterwards.
 */
function MappingPanel({ template, pending, onChange, onReset, onContinue, onCancel, busy }) {
	const [dragField, setDragField] = useState(null);
	const [overRow, setOverRow] = useState(-1);
	const fields = columnsOf(template).filter((f) => f !== EXTRA); // more_details is offered separately: any number of columns can go there
	const withDetails = hasDetails(template);
	const { headers, cells, mapping } = pending;
	const missing = missingRequired(template, mapping);
	const dupes = duplicateTargets(mapping);
	const blocked = missing.length > 0 || dupes.length > 0 || mapping.every((m) => !m);
	const sample = buildRecords(cells.slice(0, 3), mapping, headers, template).records;
	const used = [...new Set(mapping.filter(Boolean))];
	const keptAsExtra = headers.filter((_, i) => mapping[i] === EXTRA);
	const confidence = pending.confidence || [];
	const leftOver = fields.filter((f) => !used.includes(f));
	const isRequired = (f) => template.columns.some((c) => c.field === f && c.required);
	const drop = (i) => (e) => {
		e.preventDefault();
		const f = dragField || e.dataTransfer.getData('text/plain');
		setDragField(null);
		setOverRow(-1);
		if (!f) return;
		// a field sits on one column only: moving it frees the column it was on
		const from = mapping.indexOf(f);
		if (from >= 0 && from !== i) onChange(from, null);
		onChange(i, f);
	};
	return (
		<section className="isetup__card imap u-mt-4" aria-label="Match the columns">
			<h2 className="isetup__title">
				<span aria-hidden="true">
					<Icon name="check" size={14} />
				</span>{' '}
				Match your columns
			</h2>
<p className="small muted">Some column names in {pending.file.name} do not match the {humanize(template.module)} template. Check the suggested matches, then drag a field from the tray onto a column or use the list. {withDetails ? 'Columns that match no field are kept in More details, so nothing in your file is lost; choose “Don’t import” to leave one out.' : ''} {cells.length} data rows.</p>
			{leftOver.length ? (
				<div className="imap__tray" aria-label="Fields not matched yet">
					<span className="small muted">Not matched yet:</span>
					{leftOver.map((f) => (
						<span key={f} className={`imap__chip ${isRequired(f) ? 'is-required' : ''}`.trim()} draggable onDragStart={(e) => { setDragField(f); e.dataTransfer.setData('text/plain', f); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDragField(null); setOverRow(-1); }} title={isRequired(f) ? 'Required: drag onto a column' : 'Drag onto a column'}>
							{f}
							{isRequired(f) ? ' *' : ''}
						</span>
					))}
					<Button size="sm" variant="ghost" onClick={onReset} disabled={busy}>
						Reset to suggested
					</Button>
					<AiButton feature="Match the columns" disabled={busy}>
						Match with AI
					</AiButton>
				</div>
			) : (
				<div className="imap__tray">
					<span className="small muted">Every field has a column.</span>
					<Button size="sm" variant="ghost" onClick={onReset} disabled={busy}>
						Reset to suggested
					</Button>
				</div>
			)}
			<div className="imap__table" role="table" aria-label="Column mapping">
				<div className="imap__row imap__row--head" role="row">
					<span role="columnheader">Column in your file</span>
					<span role="columnheader">First value</span>
					<span role="columnheader">Import as</span>
				</div>
				{headers.map((h, i) => (
					<div className={`imap__row ${overRow === i ? 'is-over' : ''}`.trim()} role="row" key={`${h}-${i}`} onDragOver={(e) => { if (dragField) { e.preventDefault(); setOverRow(i); } }} onDragLeave={() => setOverRow((r) => (r === i ? -1 : r))} onDrop={drop(i)}>
						<span role="cell" className="imap__head">
							{h || <em className="muted">(blank)</em>}
						</span>
						<span role="cell" className="small muted imap__sample">
							{[0, 1, 2].map((r) => (cells[r] && cells[r][i]) || '').filter(Boolean).join(' · ') || '—'}
						</span>
						<span role="cell" className="imap__target">
{mapping[i] === EXTRA ? <span className="imap__badge imap__badge--medium">More details</span> : mapping[i] ? <span className={`imap__badge imap__badge--${confidence[i] || 'manual'}`}>{confidence[i] === 'high' ? 'Matched' : confidence[i] === 'medium' ? 'Check' : 'Chosen'}</span> : <span className="imap__badge imap__badge--none">Not imported</span>}
							<Select aria-label={`Field for column ${h || i + 1}`} value={mapping[i] || ''} onChange={(e) => onChange(i, e.target.value || null)}>
									<option value="">Don’t import</option>
									{withDetails ? <option value={EXTRA}>Keep in More details</option> : null}
									{fields.map((f) => (
									<option key={f} value={f}>
										{f}
										{template.columns.some((c) => c.field === f && c.required) ? ' (required)' : ''}
										{used.includes(f) && mapping[i] !== f ? ' (already used)' : ''}
									</option>
								))}
							</Select>
						</span>
					</div>
				))}
			</div>
			{missing.length ? (
				<p role="alert" className="banner banner--warning">
					Required {missing.length === 1 ? 'field' : 'fields'} not matched: {missing.join(', ')}.
				</p>
			) : null}
			{dupes.length ? (
				<p role="alert" className="banner banner--warning">
					More than one column is set to {dupes.join(', ')}. Each field can take one column.
				</p>
			) : null}
				{keptAsExtra.length ? <p className="small muted">Kept in More details: {keptAsExtra.map((h) => h || '(blank)').join(', ')}. Each is saved on the record as “column name: value”.</p> : null}
				{!blocked && sample.length ? (
				<div className="imap__preview">
					<h3 className="cc-preview__title">What will be sent for checking (first {sample.length} rows)</h3>
					<div className="cc-preview">
						<table>
							<thead>
								<tr>
									{used.map((f) => (
										<th key={f} scope="col">
											{f}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{sample.map((r, i) => (
									<tr key={i}>
										{used.map((f) => (
								<td key={f}>{r[f] ? (String(r[f]).length > 70 ? `${String(r[f]).slice(0, 70)}…` : r[f]) : <span className="muted">—</span>}</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			) : null}
			<div className="page-header__actions">
				<Button variant="primary" onClick={onContinue} disabled={blocked || busy} loading={busy}>
					Check the rows
				</Button>
				<Button onClick={onCancel} disabled={busy}>
					Choose another file
				</Button>
			</div>
		</section>
	);
}

/**
 * CSV import. Rows are validated by the server in bounded batches and nothing is saved until
 * "Import valid rows". Re-sending a batch never creates duplicates (the server is idempotent).
 */
export default function ImportPage() {
	const templates = useTemplates();
	const [sp] = useSearchParams();
	const wanted = sp.get('module') || ''; // set by the Import button on a module page, so the type is already chosen
	const [module, setModule] = useState(wanted);
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
	const [extras, setExtras] = useState([]); // headers kept in more_details
	const [lastMap, setLastMap] = useState(null); // the file and mapping of the check that is on screen, so the matching can be changed
	const [trimmedRows, setTrimmedRows] = useState(0);
	const [ragged, setRagged] = useState({ rows: [], expected: 0 }); // rows whose number of values differs from the header
	const [pending, setPending] = useState(null); // a chosen file whose headers still need matching: { file, headers, cells, mapping }
	const [final, setFinal] = useState(null);
	const [fileName, setFileName] = useState('');
	const [fileOver, setFileOver] = useState(false);
	const running = useRef(false);
	const pendingAuto = useRef({}); // the suggested mapping of the file being checked (for "Reset to suggested")
	const hasPreview = useRef(false);

	// Only record types this user may create (an import adds records; the backend checks again).
	const importable = (templates.data || []).filter((t) => t.importable && (!t.permissions || t.permissions.create));
	const template = importable.find((t) => t.module === module);
	useEffect(() => {
		if (wanted && !hasPreview.current) setModule(wanted);
	}, [wanted]);
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
		setPending(null);
		setFileName('');
	};

	const onFile = (e) => {
		const file = e.target.files[0];
		e.target.value = '';
		loadFile(file);
	};

	const loadFile = (file) => {
		if (!file || !template) return;
		setFileName(file.name);
		setPending(null);
		guard(async () => {
			if (!/\.csv$/i.test(file.name)) throw new Error('Only .csv files are supported. Excel (.xlsx) import is not available yet.');
			if (file.size > MAX_FILE_BYTES) throw new Error('File is larger than 2 MB.');
				const { headers, cells, ragged: odd, expected } = readCsv(await file.text());
				setRagged({ rows: odd, expected });
			if (cells.length > MAX_ROWS) throw new Error(`The file has ${cells.length} rows; at most ${MAX_ROWS} can be imported at once.`);
			// A mapping the user confirmed before for this exact header row is reused; otherwise the headers are matched by
			// name, aliases, spelling and what the values look like.
				const remembered = rememberedMapping(module, headers, knownOf(template));
				const matches = remembered ? remembered.map((f) => (f ? { field: f, confidence: 'high' } : null)) : matchHeaders(headers, cells, specsOf(template));
				const mapping = matches.map((m) => (m ? m.field : null));
				// A column with no field of its own is kept in more_details (when the record type has one) unless it is empty:
				// an upload in any layout imports, and nothing the user uploaded is lost. The panel shows where each column goes.
				const blank = emptyColumns(headers, cells);
				if (!remembered && hasDetails(template)) mapping.forEach((m, i) => { if (!m && !blank[i]) mapping[i] = EXTRA; });
			// Straight to validation when nothing needs a second look: every required field is matched with confidence, and any
			// column left out is a harmless extra (no template field is left uncovered because of it).
				const sure = matches.every((m) => !m || m.confidence === 'high');
				const anyExtra = mapping.includes(EXTRA);
				if (sure && missingRequired(template, mapping).length === 0 && (!anyExtra || remembered)) {
					pendingAuto.current = { auto: mapping, confidence: matches.map((m) => (m ? m.confidence : null)) };
				setPhase('idle');
				return validate(file, headers, cells, mapping);
			}
				const confidence = matches.map((m, i) => (m ? m.confidence : mapping[i] === EXTRA ? 'extra' : null));
				pendingAuto.current = { auto: mapping, confidence };
				setPending({ file, headers, cells, mapping, auto: mapping, confidence, autoConfidence: confidence });
			setPhase('idle');
		});
	};

	const validate = async (file, headers, cells, mapping) => {
		const built = buildRecords(cells, mapping, headers, template);
		const rows = built.records.map((data, i) => ({ rowNumber: i + 1, data }));
		setRecords(rows);
		setUnmapped(headers.filter((h, i) => !mapping[i] && h));
		setExtras(headers.filter((h, i) => mapping[i] === EXTRA).map((h) => h || '(blank)'));
		setTrimmedRows(built.trimmed);
		setLastMap({ file, headers, cells, mapping, auto: pendingAuto.current.auto || mapping, confidence: pendingAuto.current.confidence || [] });
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
	};

	const confirmMapping = () =>
		guard(async () => {
			const { file, headers, cells, mapping } = pending;
			await validate(file, headers, cells, mapping);
			rememberMapping(module, headers, mapping);
			setPending(null);
		});
	const rematch = () =>
		guard(async () => {
			if (!lastMap || !job) return;
			await importsService.cancel(job.id);
			const m = lastMap;
			reset();
			setFileName(m.file.name);
			setPending({ file: m.file, headers: m.headers, cells: m.cells, mapping: m.mapping, auto: m.auto, confidence: m.confidence, autoConfidence: m.confidence });
			setMessage(null);
			setPhase('idle');
		});
	const cancelMapping = () => {
		setPending(null);
		setFileName('');
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
	const locked = busy || Boolean(pending) || phase === 'previewed' || phase === 'committed';
	const canCommit = phase === 'previewed' && (counts.valid || 0) + (counts.conflict || 0) + (counts.failed || 0) > 0;

	return (
		<>
			<PageHeader title="Import data" description="Upload a CSV, review what will happen, then import. Nothing is saved until you confirm." />
			<DataEntryModes current="import" resource={module || undefined} />
			<ol className="istepper" aria-label="Progress">
				{STEPS.map((label, i) => (
					<li key={label} className={`istepper__step ${i < step ? 'is-done' : ''} ${i === step ? 'is-current' : ''}`.trim()} aria-current={i === step ? 'step' : undefined}>
						<span className="istepper__dot" aria-hidden="true">
							{i < step ? <Icon name="check" size={14} /> : i + 1}
						</span>
						<span className="istepper__label">{label}</span>
					</li>
				))}
			</ol>

			<StateView res={templates} loadingLines={2}>
				<div className="isetup">
					<section className="isetup__card" aria-label="What to import">
						<h2 className="isetup__title">
							<span aria-hidden="true">1</span> What are you importing?
						</h2>
						<Field label="Data type">
							{(p) => (
								<Select {...p} value={module} disabled={locked} onChange={(e) => setModule(e.target.value)}>
									<option value="">Select…</option>
									{importable.map((t) => (
										<option key={t.module} value={t.module}>
											{humanize(t.module)}
										</option>
									))}
								</Select>
							)}
						</Field>
						<Field label="If a record already exists">
							{(p) => (
								<Select {...p} value={policy} disabled={locked} onChange={(e) => setPolicy(e.target.value)}>
									<option value="ask">Ask me for each one</option>
									<option value="update">Update the existing record</option>
									<option value="keep_existing">Keep the existing record</option>
									<option value="skip">Skip the row</option>
								</Select>
							)}
						</Field>
						<TeamFilter value={team} onChange={setTeam} />
					</section>
					<section className="isetup__card" aria-label="Upload the file">
						<h2 className="isetup__title">
							<span aria-hidden="true">2</span> Upload the CSV
						</h2>
						<div className={`idrop ${!template || locked ? 'is-disabled' : ''} ${fileName ? 'has-file' : ''} ${fileOver ? 'is-over' : ''}`.trim()} onDragEnter={() => setFileOver(true)} onDragLeave={() => setFileOver(false)} onDrop={() => setFileOver(false)}>
							<Field label="CSV file">{(p) => <input {...p} type="file" accept=".csv,text/csv" disabled={!template || locked} onChange={onFile} />}</Field>
							<span className="idrop__icon" aria-hidden="true">
								<Icon name={fileName ? 'check' : 'upload'} size={26} />
							</span>
							<b className="idrop__title">{fileName || (template ? 'Drop a CSV here, or click to browse' : 'Choose a data type first')}</b>
							<small>{template ? 'Columns are matched to the template by name; you can match any that differ before checking. Max 2 MB, up to 5,000 rows.' : 'The template and checks depend on the data type.'}</small>
						</div>
						<Button icon="download" disabled={!template} onClick={() => downloadTemplate(template)}>
							Download template
						</Button>
					</section>
				</div>
				{!features.excelImport ? <p className="small muted">CSV files only. Excel (.xlsx) import needs a spreadsheet parser that has not been added yet. Rows can refer to people and projects by employee_code and project_code.</p> : null}
			</StateView>

			{pending && template ? <MappingPanel template={template} pending={pending} busy={busy} onChange={(i, field) => setPending((p) => ({ ...p, mapping: p.mapping.map((m, j) => (j === i ? field : m)), confidence: (p.confidence || []).map((c, j) => (j === i ? (field ? 'manual' : null) : c)) }))} onReset={() => setPending((p) => ({ ...p, mapping: p.auto, confidence: p.autoConfidence || p.confidence }))} onContinue={confirmMapping} onCancel={cancelMapping} /> : null}

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
				<section aria-label="Validation result" className="stack u-mt-4">
					<div className="legend u-mt-0">
						<span>{records.length} rows</span>
						<StatusBadge tone="info" status="valid" label={`${(counts.valid || 0) + (counts.committed || 0)} ready or imported`} />
						<StatusBadge tone="warning" status="conflict" label={`${counts.conflict || 0} already exist`} />
						<StatusBadge tone="danger" status="invalid" label={`${counts.invalid || 0} invalid`} />
						{counts.failed ? <StatusBadge tone="danger" status="failed" label={`${counts.failed} failed (safe to retry)`} /> : null}
						{counts.skipped ? <StatusBadge status="skipped" label={`${counts.skipped} skipped`} /> : null}
					</div>
						{ragged.rows.length ? (
							<p role="alert" className="banner banner--warning">
								{ragged.rows.length === 1 ? 'Row' : 'Rows'} {ragged.rows.slice(0, 12).map((r) => r.rowNumber).join(', ')}
								{ragged.rows.length > 12 ? ` and ${ragged.rows.length - 12} more` : ''} in your file {ragged.rows.length === 1 ? 'has' : 'have'} a different number of values than the header ({ragged.expected}), for example {ragged.rows[0].got} in row {ragged.rows[0].rowNumber}. A comma is probably missing or extra, which shifts the values after it into the wrong columns. Fix {ragged.rows.length === 1 ? 'that row' : 'those rows'} in the file and upload it again.
							</p>
						) : null}
						{extras.length ? <p className="banner banner--info">Kept in More details (no matching field): {extras.join(', ')}.{trimmedRows ? ` Long values were shortened on ${trimmedRows} ${trimmedRows === 1 ? 'row' : 'rows'}.` : ''}</p> : null}
						{unmapped.length ? <p className="banner banner--warning">Not imported (left out): {unmapped.join(', ')}</p> : null}
					<p className="small muted">Checked: types, required fields, allowed values, team access, duplicates and existing records. Rows are matched by a stable key, so importing the same file twice never creates duplicates.</p>

					{conflicts.length ? (
						<div>
							<h2 className="section-title u-mt-0">Records that already exist</h2>
							<DataTable
								caption="Conflicts"
								rowKey="rowNumber"
								columns={[
									{ key: 'rowNumber', label: 'Row' },
									{
										key: 'choice',
										label: 'What to do',
										render: (r) => (
											<Select className="input u-w-auto" aria-label={`Resolution for row ${r.rowNumber}`} value={choices[r.rowNumber] || (r.conflict && r.conflict.resolution) || ''} disabled={busy || phase !== 'previewed'} onChange={(e) => setChoices((c) => ({ ...c, [r.rowNumber]: e.target.value }))}>
												<option value="">Use the default above</option>
												<option value="update">Update existing</option>
												<option value="keep_existing">Keep existing</option>
												<option value="skip">Skip</option>
											</Select>
										),
									},
								]}
								rows={conflictPage.rows}
							/>
							<Pagination {...conflictPage.pagination} />
							<div className="u-mt-2">
								<Button disabled={busy || phase !== 'previewed' || Object.keys(choices).length === 0} onClick={saveChoices}>
									Save choices
								</Button>
							</div>
						</div>
					) : null}

					{problems.length ? (
						<div>
							<h2 className="section-title u-mt-0">Rows with problems</h2>
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
							{job && lastMap && phase === 'previewed' ? (
								<Button disabled={busy} onClick={rematch}>
									Change how columns are matched
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
