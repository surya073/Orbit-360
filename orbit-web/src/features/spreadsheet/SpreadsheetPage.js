import React, { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import Button from '../../components/common/Button';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/feedback/EmptyState';
import ErrorState from '../../components/feedback/ErrorState';
import LoadingState from '../../components/feedback/LoadingState';
import { useToast } from '../../components/feedback/ToastProvider';
import Field from '../../components/forms/Field';
import PageHeader from '../../components/layout/PageHeader';
import Pagination from '../../components/tables/Pagination';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import useLookupLabels from '../../hooks/useLookup';
import useTemplates from '../../hooks/useTemplates';
import useUnsavedGuard from '../../hooks/useUnsavedGuard';
import DataEntryModes from './DataEntryModes';
import { rowsToCsv } from './gridModel';
import SheetGrid from './SheetGrid';
import SheetToolbar from './SheetToolbar';
import { SHEET_MODULES, sheetModule } from './spreadsheetModules';
import useSheetData from './useSheetData';
import useSheetView from './useSheetView';

const FK_COLUMNS = ['employee_id', 'reports_to_employee_id', 'assignee_employee_id', 'project_id', 'team_id', 'primary_team_id'];

function download(name, text) {
	const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	a.click();
	URL.revokeObjectURL(url);
}

/** The sheet for one record type. Remounted per module so each starts clean. */
function Sheet({ mod, template, canWrite }) {
	const { notify } = useToast();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [filters, setFilters] = useState([]);
	const [sort, setSort] = useState(null);
	const [selected, setSelected] = useState([]); // view-row keys
	const [confirmDelete, setConfirmDelete] = useState(false);
	const dsearch = useDebouncedValue(search, 350);
	const serverSearch = Boolean(mod.search);

	const data = useSheetData({ resource: mod.resource, template, canWrite, search: serverSearch ? dsearch : '', page });
	const { res, rows, columns, state } = data;
	const labelOf = useLookupLabels(rows, FK_COLUMNS);
	const view = useSheetView({ rows, state, valueOf: data.valueOf, columns, sort, filters, query: serverSearch ? '' : search, labelOf });
	useUnsavedGuard(data.dirtyCount > 0);

	const toggleSort = useCallback((field) => setSort((s) => (!s || s.field !== field ? { field, dir: 'asc' } : s.dir === 'asc' ? { field, dir: 'desc' } : null)), []);

	const onNotice = useCallback((message, tone = 'error') => notify(message, tone), [notify]);
	const addRow = useCallback(() => data.addRows(1), [data]);

	const save = async () => {
		const out = await data.save();
		if (!out) return;
		if (out.error) return notify(`Nothing was saved: ${out.error}`, 'error');
		const parts = [out.created && `${out.created} created`, out.updated && `${out.updated} updated`].filter(Boolean).join(', ');
		const problems = out.failed + out.conflicts + out.invalid;
		if (problems) notify(`${parts ? `${parts}. ` : ''}${problems} row${problems > 1 ? 's' : ''} need attention (marked in the sheet). Your edits are kept.`, 'error');
		else if (parts) notify(`Saved: ${parts}`);
	};

	const selectedViewRows = view.filter((r) => selected.includes(r.key));
	const selectedNew = selectedViewRows.filter((r) => r.isNew).map((r) => r.key);
	const selectedExisting = selectedViewRows.filter((r) => !r.isNew).map((r) => r.id);
	const doDelete = () => {
		if (selectedNew.length) data.removeNewRows(selectedNew);
		if (selectedExisting.length) setConfirmDelete(true);
	};

	const exportCsv = () => download(`${mod.resource}.csv`, rowsToCsv(columns, view, (r, f) => r.values[f]));
	const sortCol = sort && columns.find((c) => c.field === sort.field);
	const { status } = data.saveState;
	const loadedAll = res.status === 'success' || res.status === 'empty';

	let statusText = 'No unsaved changes';
	if (status === 'saving') statusText = 'Saving…';
	else if (data.dirtyCount) statusText = `${data.dirtyCount} unsaved change${data.dirtyCount > 1 ? 's' : ''}`;
	else if (status === 'saved') statusText = `All changes saved${data.saveState.at ? ` at ${data.saveState.at.toLocaleTimeString()}` : ''}`;

	return (
		<>
			<SheetToolbar
				title={mod.title}
				canWrite={canWrite}
				dirtyCount={data.dirtyCount}
				saving={status === 'saving'}
				onSave={save}
				onDiscard={data.discard}
				canUndo={data.canUndo}
				canRedo={data.canRedo}
				onUndo={data.undo}
				onRedo={data.redo}
				onAddRow={addRow}
				canDelete={selectedViewRows.length > 0}
				onDelete={doDelete}
				search={search}
				onSearch={setSearch}
				searchLabel={serverSearch ? mod.search : 'Search this page'}
				columns={columns}
				filters={filters}
				onFilters={setFilters}
				sortLabel={sortCol ? `${sortCol.label} ${sort.dir === 'asc' ? '↑' : '↓'}` : null}
				onClearSort={() => setSort(null)}
				onExport={exportCsv}
				canExport={view.length > 0}
				onReload={res.reload}
				loading={res.status === 'loading'}
			/>
			{res.status === 'error' ? (
				<ErrorState error={res.error} onRetry={res.reload} />
			) : res.status === 'loading' && !res.data ? (
				<LoadingState lines={8} label="Loading records" />
			) : (
				<>
					{data.hasConflicts ? (
						<p role="alert" className="banner banner--warning">
							Some records changed on the server after you loaded them. Reload to see the latest values, or overwrite the server with your edits.{' '}
							<Button size="sm" onClick={() => data.save({ overwrite: true })} disabled={status === 'saving'}>
								Overwrite and save
							</Button>
						</p>
					) : null}
					{loadedAll && view.length === 0 && !state.newRows.length ? (
						<EmptyState
							icon="search"
							title={search || filters.length ? 'No rows match' : `No ${mod.title.toLowerCase()} yet`}
							message={search || filters.length ? 'Clear the search or filters to see the loaded rows.' : canWrite ? 'Add a row to start entering records.' : 'There are no records to show.'}
							action={canWrite && !search && !filters.length ? <Button variant="primary" icon="plus" onClick={addRow}>Add row</Button> : null}
						/>
					) : (
						<div className="sheet" aria-busy={res.status === 'loading'}>
							<SheetGrid
								label={`${mod.title} spreadsheet`}
								columns={columns}
								rows={view}
								labelOf={labelOf}
								readOnly={!canWrite}
								canAddRows={canWrite}
								onSetCells={data.setCells}
								onAddRows={data.addRows}
								onNotice={onNotice}
								onUndo={data.undo}
								onRedo={data.redo}
								sort={sort}
								onSort={toggleSort}
								onSelectRows={setSelected}
							/>
						</div>
					)}
					<div className="sheet-status" role="status" aria-live="polite">
						<span className={`sheet-status__dot ${data.dirtyCount ? 'is-dirty' : status === 'saved' ? 'is-saved' : ''}`.trim()} aria-hidden="true" />
						<span>{statusText}</span>
						<span className="muted">
							{view.length} row{view.length === 1 ? '' : 's'} shown · {res.meta ? `${res.meta.total} total` : ''}
						</span>
						<span className="muted sheet-status__hint">Enter or F2 edits · Tab moves · Ctrl+C / Ctrl+V copy and paste · Esc cancels</span>
					</div>
					<Pagination meta={res.meta} onPage={setPage} />
				</>
			)}
			{confirmDelete ? (
				<ConfirmDialog
					title={`Delete ${selectedExisting.length} record${selectedExisting.length > 1 ? 's' : ''}?`}
					message="This is applied immediately and cannot be undone here. Deleted records are removed from lists and totals; an administrator can restore them from the data store."
					onCancel={() => setConfirmDelete(false)}
					onConfirm={async () => {
						await data.deleteRecords(selectedExisting);
						setConfirmDelete(false);
						notify('Records deleted');
					}}
				/>
			) : null}
		</>
	);
}

/** Spreadsheet editor: the third way to enter data, next to the Add form and Sheet import. */
export default function SpreadsheetPage() {
	const { user } = useAuth();
	const templates = useTemplates();
	const [sp, setSp] = useSearchParams();
	const available = useMemo(() => SHEET_MODULES.filter((m) => templates.byModule[m.resource]), [templates.byModule]);
	const wanted = sp.get('module');
	const mod = (wanted && available.find((m) => m.resource === wanted)) || available[0] || null;
	const template = mod ? templates.byModule[mod.resource] : null;
	const canWrite = Boolean(template && (!template.adminOnly || user.role === 'admin'));

	return (
		<>
			<PageHeader title="Spreadsheet editor" description="Edit existing records and add new ones in a grid. Changes are saved to the same records as the Add form and Sheet import." />
			<DataEntryModes current="sheet" resource={mod && mod.resource} />
			{templates.status === 'error' ? (
				<p role="alert" className="banner banner--error">
					The spreadsheet is unavailable: {templates.error.message}
				</p>
			) : null}
			{mod ? (
				<>
					<div className="sheet-picker">
						<Field label="Record type">
							{(p) => (
								<select {...p} value={mod.resource} onChange={(e) => setSp({ module: e.target.value }, { replace: true })}>
									{available.map((m) => (
										<option key={m.resource} value={m.resource}>
											{m.title}
										</option>
									))}
								</select>
							)}
						</Field>
						<p className="small muted">
							Columns are the fields this record type supports; new columns cannot be added because the schema is fixed. Saved values cannot be cleared, and fields that identify a record cannot be changed after it is created.
							{!canWrite ? ' Only administrators can change this record type.' : ''}
						</p>
					</div>
					<Sheet key={mod.resource} mod={sheetModule(mod.resource)} template={template} canWrite={canWrite} />
				</>
			) : templates.status === 'loading' ? (
				<LoadingState lines={6} label="Loading spreadsheet" />
			) : null}
		</>
	);
}

