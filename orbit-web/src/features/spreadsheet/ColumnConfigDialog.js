import React, { useMemo, useState } from 'react';
import Button from '../../components/common/Button';
import SearchBox from '../../components/forms/SearchBox';
import Modal from '../../components/common/Modal';
import SortableList from '../../components/common/SortableList';
import { Checkbox } from '../../components/forms/Choice';
import { applyConfig, defaultConfig, isDefaultConfig, MAX_LABEL, sanitizeConfig } from '../../utils/columnConfig';

const TYPE_NAMES = { str: 'Text', num: 'Number', int: 'Number', date: 'Date', enum: 'Choice', bool: 'Yes / No', fk: 'Link' };
const PREVIEW_ROWS = 3;

/**
 * Pick, order and rename the columns of an export. The list of columns comes from the module's schema (`columns`);
 * the dialog can only reorder, hide and relabel them, so a field outside the schema can never be exported.
 * `onConfirm({ config, headers })` receives a sanitised config and which header style to write.
 */
export default function ColumnConfigDialog({ title = 'Export columns', columns, initial, previewRows = [], getValue, rowCount, confirmLabel = 'Download CSV', onConfirm, onClose }) {
	const [cfg, setCfg] = useState(() => sanitizeConfig(initial, columns));
	const [query, setQuery] = useState('');
	const [headers, setHeaders] = useState('labels');
	const [remember, setRemember] = useState(true);
	const byField = useMemo(() => new Map(columns.map((c) => [c.field, c])), [columns]);
	const shown = applyConfig(cfg, columns);
	const searching = query.trim() !== '';
	const needle = query.trim().toLowerCase();
	const items = cfg.order.map((f) => ({ id: f, label: cfg.labels[f] || byField.get(f).label })).filter((it) => !searching || it.label.toLowerCase().includes(needle) || it.id.toLowerCase().includes(needle));

	const setVisible = (f, on) => setCfg((c) => ({ ...c, hidden: on ? c.hidden.filter((x) => x !== f) : [...c.hidden, f] }));
	const setLabel = (f, text) => setCfg((c) => ({ ...c, labels: { ...c.labels, [f]: text.slice(0, MAX_LABEL) } }));
	const setAll = (on) => setCfg((c) => ({ ...c, hidden: on ? [] : c.order.slice() }));
	const reorder = (order) => setCfg((c) => ({ ...c, order }));
	const reset = () => {
		setCfg(defaultConfig(columns));
		setQuery('');
	};
	const clean = () => sanitizeConfig(cfg, columns);
	const headerOf = (c) => (headers === 'fields' ? c.field : c.exportLabel);

	const row = (it, extras = {}) => {
		const col = byField.get(it.id);
		const on = !cfg.hidden.includes(it.id);
		return (
			<div className={`cc-row ${on ? '' : 'is-off'}`.trim()}>
				{extras.handle || <span className="cc-row__spacer" aria-hidden="true" />}
				<Checkbox aria-label={`Include ${it.label}`} checked={on} onChange={(e) => setVisible(it.id, e.target.checked)} label="" />
				<div className="cc-row__main">
					<input className="input cc-row__label" aria-label={`Header for ${col.label}`} placeholder={col.label} maxLength={MAX_LABEL} value={cfg.labels[it.id] ?? ''} onChange={(e) => setLabel(it.id, e.target.value)} disabled={!on} />
					<span className="small muted cc-row__meta">
						<code>{it.id}</code> · {TYPE_NAMES[col.type] || 'Text'}
						{col.required ? <b className="cc-req">Required</b> : <span>Optional</span>}
					</span>
				</div>
				{extras.moveUp ? (
					<div className="cc-row__moves">
						<Button size="sm" variant="ghost" aria-label={`Move ${it.label} up`} disabled={extras.isFirst} onClick={extras.moveUp}>
							↑
						</Button>
						<Button size="sm" variant="ghost" aria-label={`Move ${it.label} down`} disabled={extras.isLast} onClick={extras.moveDown}>
							↓
						</Button>
					</div>
				) : null}
			</div>
		);
	};

	return (
		<Modal
			title={title}
			size="lg"
			onClose={onClose}
			footer={
				<>
					<label className="cc-remember">
						<input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember on this device
					</label>
					<Button onClick={onClose}>Cancel</Button>
					<Button variant="primary" icon="download" disabled={shown.length === 0} onClick={() => onConfirm({ config: clean(), headers, remember })}>
						{confirmLabel}
					</Button>
				</>
			}
		>
			<div className="cc">
				<div className="cc-tools">
					<div className="cc-search">
<SearchBox aria-label="Search columns" placeholder="Search columns or field names" value={query} onChange={setQuery} />
					</div>
					<Button size="sm" onClick={() => setAll(true)}>
						Select all
					</Button>
					<Button size="sm" onClick={() => setAll(false)}>
						Select none
					</Button>
					<Button size="sm" icon="refresh" onClick={reset} disabled={isDefaultConfig(cfg, columns) && !searching}>
						Reset
					</Button>
				</div>
				<p className="small muted" role="status">
					{shown.length} of {columns.length} columns selected. Drag a handle, or use the arrows, to change the order. Renaming only changes the header in the file, never the field itself.
				</p>
				{items.length === 0 ? (
					<p className="muted">No column matches “{query}”.</p>
				) : searching ? (
					<>
						<p className="small muted">Clear the search to change the order.</p>
						<ul className="cc-list">
							{items.map((it) => (
								<li key={it.id}>{row(it)}</li>
							))}
						</ul>
					</>
				) : (
					<SortableList label="Columns" items={items} onReorder={reorder} renderItem={(it, o) => row(it, o)} />
				)}

				<div className="cc-opts">
					<span className="cc-opts__label">Header row</span>
					<label>
						<input type="radio" name="cc-headers" checked={headers === 'labels'} onChange={() => setHeaders('labels')} /> Column names
					</label>
					<label>
						<input type="radio" name="cc-headers" checked={headers === 'fields'} onChange={() => setHeaders('fields')} /> Field names (best for re-importing)
					</label>
				</div>

				<section aria-label="Preview of the file">
					<h3 className="cc-preview__title">Preview</h3>
					{shown.length === 0 ? (
						<p className="muted">Select at least one column to export.</p>
					) : (
						<div className="cc-preview">
							<table>
								<thead>
									<tr>
										{shown.map((c) => (
											<th key={c.field} scope="col">
												{headerOf(c)}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{previewRows.slice(0, PREVIEW_ROWS).map((r, i) => (
										<tr key={i}>
											{shown.map((c) => (
												<td key={c.field}>{String(getValue(r, c.field) ?? '') || <span className="muted">—</span>}</td>
											))}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
					<p className="small muted">{rowCount ? `${rowCount} row${rowCount === 1 ? '' : 's'} will be exported${previewRows.length ? `; the first ${Math.min(PREVIEW_ROWS, previewRows.length)} are shown.` : '.'}` : 'There are no rows to export yet: the file will contain only the header row.'}</p>
				</section>
			</div>
		</Modal>
	);
}
