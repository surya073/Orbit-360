import React, { forwardRef, useState } from 'react';
import Button, { IconButton } from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import Popover from '../../components/common/Popover';
import { humanize } from '../../utils/format';
import { FILTER_OPS } from './gridModel';
import Select from '../../components/forms/Select';
import SearchBox from '../../components/forms/SearchBox';
import { Switch } from '../../components/forms/Choice';

export function FilterPanel({ columns, filters, onChange }) {
	const [field, setField] = useState(columns[0] ? columns[0].field : '');
	const [op, setOp] = useState('contains');
	const [value, setValue] = useState('');
	const col = columns.find((c) => c.field === field);
	const choices = col && col.type === 'enum' ? col.values : col && col.type === 'bool' ? ['true', 'false'] : null;
	const add = (e) => {
		e.preventDefault();
		if (!col || value === '') return;
		onChange([...filters, { field, op: choices ? 'equals' : op, value }]);
		setValue('');
	};
	return (
		<form className="sheet-filter" onSubmit={add}>
			<p className="small muted">Filters apply to the rows loaded on this page.</p>
			<label className="sheet-filter__row">
				<span>Column</span>
				<Select
					value={field}
					onChange={(e) => {
						setField(e.target.value);
						setValue('');
					}}
				>
					{columns.map((c) => (
						<option key={c.field} value={c.field}>
							{c.label}
						</option>
					))}
				</Select>
			</label>
			{choices ? (
				<label className="sheet-filter__row">
					<span>Is</span>
					<Select value={value} onChange={(e) => setValue(e.target.value)}>
						<option value="">Choose…</option>
						{choices.map((v) => (
							<option key={v} value={v}>
								{col.type === 'bool' ? (v === 'true' ? 'Yes' : 'No') : humanize(v)}
							</option>
						))}
					</Select>
				</label>
			) : (
				<>
					<label className="sheet-filter__row">
						<span>Condition</span>
						<Select value={op} onChange={(e) => setOp(e.target.value)}>
							{Object.entries(FILTER_OPS).map(([k, label]) => (
								<option key={k} value={k}>
									{label}
								</option>
							))}
						</Select>
					</label>
					<label className="sheet-filter__row">
						<span>Value</span>
						<input value={value} onChange={(e) => setValue(e.target.value)} />
					</label>
				</>
			)}
			<Button type="submit" size="sm" variant="primary" disabled={value === ''}>
				Add filter
			</Button>
			{filters.length ? (
				<ul className="sheet-filter__list" aria-label="Active filters">
					{filters.map((f, i) => (
						<li key={`${f.field}-${i}`}>
							<span>
								{(columns.find((c) => c.field === f.field) || {}).label} {FILTER_OPS[f.op]} “{f.value}”
							</span>
							<IconButton icon="x" label={`Remove filter ${i + 1}`} onClick={() => onChange(filters.filter((_, j) => j !== i))} />
						</li>
					))}
				</ul>
			) : null}
		</form>
	);
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
export const MOD = isMac ? '⌘' : 'Ctrl+';

/** Small labelled toolbar button: compact text control with the shortcut in its tooltip. */
function Tool({ label, hint, onClick, disabled, danger, icon, children }) {
	return (
		<Button size="sm" variant={danger ? 'danger' : 'ghost'} icon={icon} onClick={onClick} disabled={disabled} title={hint ? `${label} (${hint})` : label} aria-label={label}>
			{children}
		</Button>
	);
}

const STATUS_ICON = { saved: 'check', dirty: 'edit', saving: 'refresh', failed: 'alert', partial: 'alert', idle: 'check' };

/**
 * Compact spreadsheet toolbar in four groups (file/data, editing, data tools, view). Every control
 * works; unavailable ones are disabled (and the editing group is hidden for read-only roles).
 */
const SheetToolbar = forwardRef(function SheetToolbar(
	{ title, canWrite, status, dirtyCount, saving, onSave, onDiscard, onCut, onCopy, onPaste, canDelete, onDelete, search, onSearch, searchLabel, searchScope, onSearchScope, canServerSearch, sortLabel, onClearSort, onExport, canExport, onReload, loading, density, onDensity, onShortcuts, autosave = false, onAutosave = () => {} },
	searchRef
) {
	return (
		<div className="sheet-toolbar" role="toolbar" aria-label="Spreadsheet actions">
			<div className="sheet-toolbar__group sheet-toolbar__group--title">
				<h2 className="sheet-toolbar__title">{title}</h2>
				<span className={`sheet-state sheet-state--${status.kind}`} role="status" aria-live="polite">
					<Icon name={STATUS_ICON[status.kind] || 'check'} size={13} />
					{status.text}
				</span>
			</div>

			{canWrite ? (
				<div className="sheet-toolbar__group" role="group" aria-label="File and data">
					<Button size="sm" variant="primary" icon="check" onClick={onSave} loading={saving} disabled={dirtyCount === 0} title={`Save changes (${MOD}S)`} aria-label={`Save changes${dirtyCount ? ` (${dirtyCount})` : ''}`}>
						Save{dirtyCount ? ` (${dirtyCount})` : ''}
					</Button>
					<Tool label="Discard changes" onClick={onDiscard} disabled={dirtyCount === 0 || saving}>
						Discard
					</Tool>
				</div>
			) : (
				<span className="badge badge--neutral">Read-only</span>
			)}

			{canWrite ? (
				<div className="sheet-toolbar__group" role="group" aria-label="Editing">
					<Tool label="Delete selected rows" icon="trash" danger onClick={onDelete} disabled={!canDelete}>
						Delete rows
					</Tool>
				</div>
			) : null}

			<div className="sheet-toolbar__spacer" />

			<div className="sheet-toolbar__group" role="group" aria-label="Data tools">
<SearchBox ref={searchRef} className="sheet-search" aria-label={searchLabel} placeholder={`Search…  ${MOD}F`} value={search} onChange={onSearch} />
				{canServerSearch ? (
					<Select className="sheet-scope" aria-label="Where to search" value={searchScope} onChange={(e) => onSearchScope(e.target.value)} title="Search all records on the server (by name), or only the rows loaded in the grid (every column)">
						<option value="server">All records</option>
						<option value="loaded">Loaded rows</option>
					</Select>
				) : null}
				{sortLabel ? (
					<Button size="sm" variant="secondary" onClick={onClearSort} title="Clear sort">
						Sort: {sortLabel} ✕
					</Button>
				) : null}
				<IconButton icon="refresh" label="Reload from server" onClick={onReload} disabled={loading} />
			</div>

			<div className="sheet-toolbar__group" role="group" aria-label="View and export">
				<Popover
					label="View options"
					align="right"
					trigger={({ toggle, props }) => (
						<Button size="sm" variant="ghost" icon="settings" onClick={toggle} {...props}>
							View
						</Button>
					)}
				>
					{({ close }) => (
						<div className="sheet-filter">
							<span className="small muted">Row density</span>
							{['compact', 'comfortable'].map((d) => (
								<label key={d} className="sheet-filter__row sheet-filter__row--inline">
									<input
										type="radio"
										name="sheet-density"
										checked={density === d}
										onChange={() => {
											onDensity(d);
											close();
										}}
									/>
									<span className="u-capitalize">{d}</span>
								</label>
							))}
							{canWrite ? (
								<>
									<span className="small muted">Saving</span>
									<Switch label="Autosave edits" hint="Saves changes to existing records a few seconds after you stop typing. New rows are saved with Save." checked={autosave} onChange={(e) => onAutosave(e.target.checked)} />
								</>
							) : null}
							<p className="small muted">Column widths are remembered per record type on this device.</p>
						</div>
					)}
				</Popover>
				<Tool label="Download the visible rows as CSV" icon="download" onClick={onExport} disabled={!canExport}>
					Export
				</Tool>
				<IconButton icon="info" label="Keyboard shortcuts" onClick={onShortcuts} />
			</div>
		</div>
	);
});

export default SheetToolbar;
