import React, { useState } from 'react';
import Button, { IconButton } from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import Popover from '../../components/common/Popover';
import { humanize } from '../../utils/format';
import { FILTER_OPS } from './gridModel';

function FilterPanel({ columns, filters, onChange }) {
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
				<select
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
				</select>
			</label>
			{choices ? (
				<label className="sheet-filter__row">
					<span>Is</span>
					<select value={value} onChange={(e) => setValue(e.target.value)}>
						<option value="">Choose…</option>
						{choices.map((v) => (
							<option key={v} value={v}>
								{col.type === 'bool' ? (v === 'true' ? 'Yes' : 'No') : humanize(v)}
							</option>
						))}
					</select>
				</label>
			) : (
				<>
					<label className="sheet-filter__row">
						<span>Condition</span>
						<select value={op} onChange={(e) => setOp(e.target.value)}>
							{Object.entries(FILTER_OPS).map(([k, label]) => (
								<option key={k} value={k}>
									{label}
								</option>
							))}
						</select>
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

/**
 * Toolbar. Only actions that work for the current sheet are shown; the rest are disabled with a
 * reason where it helps (e.g. a read-only role).
 */
export default function SheetToolbar({ title, canWrite, dirtyCount, saving, onSave, onDiscard, canUndo, canRedo, onUndo, onRedo, onAddRow, canDelete, onDelete, search, onSearch, searchLabel, columns, filters, onFilters, sortLabel, onClearSort, onExport, canExport, onReload, loading }) {
	return (
		<div className="sheet-toolbar" role="toolbar" aria-label="Spreadsheet actions">
			<h2 className="sheet-toolbar__title">{title}</h2>
			<div className="sheet-toolbar__group">
				{canWrite ? (
					<>
						<Button variant="primary" icon="check" onClick={onSave} loading={saving} disabled={dirtyCount === 0}>
							Save changes{dirtyCount ? ` (${dirtyCount})` : ''}
						</Button>
						<Button variant="ghost" onClick={onDiscard} disabled={dirtyCount === 0 || saving}>
							Discard
						</Button>
					</>
				) : (
					<span className="badge badge--neutral">Read-only</span>
				)}
			</div>
			{canWrite ? (
				<div className="sheet-toolbar__group">
					<Button variant="ghost" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
						↶ Undo
					</Button>
					<Button variant="ghost" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
						↷ Redo
					</Button>
					<Button icon="plus" onClick={onAddRow}>
						Add row
					</Button>
					<Button icon="trash" variant="danger" onClick={onDelete} disabled={!canDelete}>
						Delete rows
					</Button>
				</div>
			) : null}
			<div className="sheet-toolbar__spacer" />
			<div className="sheet-toolbar__group">
				<div className="search-input sheet-search">
					<Icon name="search" size={14} />
					<input type="search" className="input" aria-label={searchLabel} placeholder="Search" value={search} onChange={(e) => onSearch(e.target.value)} />
				</div>
				<Popover
					label="Filter rows"
					align="right"
					trigger={({ toggle, props }) => (
						<Button icon="filter" onClick={toggle} {...props}>
							Filter{filters.length ? ` (${filters.length})` : ''}
						</Button>
					)}
				>
					<FilterPanel columns={columns} filters={filters} onChange={onFilters} />
				</Popover>
				{sortLabel ? (
					<Button variant="ghost" onClick={onClearSort} title="Clear sort">
						Sorted: {sortLabel} ✕
					</Button>
				) : null}
				<Button icon="download" onClick={onExport} disabled={!canExport} title="Download the visible rows as CSV">
					Export CSV
				</Button>
				<IconButton icon="refresh" label="Reload from server" onClick={onReload} disabled={loading} />
			</div>
		</div>
	);
}
