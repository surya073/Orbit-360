import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import Button from '../../components/common/Button';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Icon from '../../components/common/Icon';
import Popover from '../../components/common/Popover';
import EmptyState from '../../components/feedback/EmptyState';
import ErrorState from '../../components/feedback/ErrorState';
import LoadingState from '../../components/feedback/LoadingState';
import { useToast } from '../../components/feedback/ToastProvider';
import Pagination from '../../components/tables/Pagination';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import useLookupLabels from '../../hooks/useLookup';
import useTemplates from '../../hooks/useTemplates';
import useUnsavedGuard from '../../hooks/useUnsavedGuard';
import DataEntryModes from './DataEntryModes';
import { rowsToCsv } from './gridModel';
import SheetGrid from './SheetGrid';
import SheetShortcuts from './SheetShortcuts';
import SheetToolbar from './SheetToolbar';
import { SHEET_MODULES, sheetModule } from './spreadsheetModules';
import useSheetData from './useSheetData';
import useSheetView from './useSheetView';

const FK_COLUMNS = ['employee_id', 'reports_to_employee_id', 'assignee_employee_id', 'project_id', 'team_id', 'primary_team_id'];
const DENSITY_KEY = 'company360.sheetDensity';

function readDensity() {
	try {
		return window.localStorage.getItem(DENSITY_KEY) === 'comfortable' ? 'comfortable' : 'compact';
	} catch {
		return 'compact';
	}
}

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
	// The page belongs to the query it was chosen for, so a new search always starts on page 1
	// (without first requesting the old query's page N).
	const [pageState, setPageState] = useState({ q: '', page: 1 });
	const [search, setSearch] = useState('');
	const [scope, setScope] = useState(mod.search ? 'server' : 'loaded');
	const [filters, setFilters] = useState([]);
	const [sort, setSort] = useState(null);
	const [selected, setSelected] = useState([]); // view-row keys
	const [selInfo, setSelInfo] = useState(null);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [shortcuts, setShortcuts] = useState(false);
	const [density, setDensity] = useState(readDensity);
	const gridRef = useRef(null);
	const searchRef = useRef(null);

	const serverSearch = Boolean(mod.search) && scope === 'server';
	const dsearch = useDebouncedValue(serverSearch ? search.trim() : '', 350); // one request per pause, not per keystroke
	const page = pageState.q === dsearch ? pageState.page : 1;
	const setPage = useCallback((p) => setPageState({ q: dsearch, page: p }), [dsearch]);

	const data = useSheetData({ resource: mod.resource, template, canWrite, search: dsearch, page });
	const { res, rows, columns, state } = data;
	const labelOf = useLookupLabels(rows, FK_COLUMNS);
	const view = useSheetView({ rows, state, valueOf: data.valueOf, columns, sort, filters, query: serverSearch ? '' : search, labelOf });
	useUnsavedGuard(data.dirtyCount > 0);

	const toggleSort = useCallback((field) => setSort((s) => (!s || s.field !== field ? { field, dir: 'asc' } : s.dir === 'asc' ? { field, dir: 'desc' } : null)), []);
	const onNotice = useCallback((message, tone = 'error') => notify(message, tone), [notify]);
	const addRow = useCallback(() => data.addRows(1), [data]);
	const changeDensity = useCallback((d) => {
		setDensity(d);
		try {
			window.localStorage.setItem(DENSITY_KEY, d);
		} catch {
			/* preference simply is not remembered */
		}
	}, []);

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
		if (!canWrite || !selectedViewRows.length) return;
		if (selectedNew.length) data.removeNewRows(selectedNew);
		if (selectedExisting.length) setConfirmDelete(true);
	};

	const exportCsv = () => download(`${mod.resource}.csv`, rowsToCsv(columns, view, (r, f) => r.values[f]));
	const sortCol = sort && columns.find((c) => c.field === sort.field);
	const { status } = data.saveState;
	const loadedAll = res.status === 'success' || res.status === 'empty';
	const hasRowErrors = Object.keys(state.errors).length > 0;

	let saveStatus = { kind: 'saved', text: data.saveState.at ? `Saved ${data.saveState.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Saved' };
	if (status === 'saving') saveStatus = { kind: 'saving', text: 'Saving…' };
	else if (status === 'error') saveStatus = { kind: 'failed', text: 'Save failed' };
	else if (status === 'partial' || hasRowErrors) saveStatus = { kind: 'partial', text: 'Some changes failed' };
	else if (data.dirtyCount) saveStatus = { kind: 'dirty', text: `${data.dirtyCount} unsaved change${data.dirtyCount > 1 ? 's' : ''}` };

	// Workspace shortcuts. Only active while focus is inside the sheet (never page-wide), and never
	// while a cell editor, dialog or popover input has the keyboard.
	const onWorkspaceKeyDown = (e) => {
		const mine = (e.ctrlKey || e.metaKey) && !e.altKey;
		if (!mine || e.target.closest('.sheet-editor, [role="dialog"], .popover')) return;
		const k = e.key.toLowerCase();
		if (k === 'f' && !e.shiftKey) {
			e.preventDefault();
			if (searchRef.current) {
				searchRef.current.focus();
				searchRef.current.select();
			}
		} else if (k === 's' && !e.shiftKey) {
			e.preventDefault();
			if (canWrite && data.dirtyCount && status !== 'saving') save();
		}
	};

	const searching = search.trim() !== '' || filters.length > 0;
	const empty = loadedAll && view.length === 0 && !state.newRows.length;

	return (
		<div className="sheet-workspace" onKeyDown={onWorkspaceKeyDown}>
			<SheetToolbar
				ref={searchRef}
				title={mod.title}
				canWrite={canWrite}
				status={saveStatus}
				dirtyCount={data.dirtyCount}
				saving={status === 'saving'}
				onSave={save}
				onDiscard={data.discard}
				canUndo={data.canUndo}
				canRedo={data.canRedo}
				onUndo={data.undo}
				onRedo={data.redo}
				onCut={() => gridRef.current && gridRef.current.cut()}
				onCopy={() => gridRef.current && gridRef.current.copy()}
				onPaste={() => gridRef.current && gridRef.current.paste()}
				onAddRow={addRow}
				canDelete={selectedViewRows.length > 0}
				onDelete={doDelete}
				search={search}
				onSearch={setSearch}
				searchLabel={serverSearch ? mod.search : 'Search loaded rows'}
				searchScope={scope}
				onSearchScope={setScope}
				canServerSearch={Boolean(mod.search)}
				columns={columns}
				filters={filters}
				onFilters={setFilters}
				sortLabel={sortCol ? `${sortCol.label} ${sort.dir === 'asc' ? '↑' : '↓'}` : null}
				onClearSort={() => setSort(null)}
				onExport={exportCsv}
				canExport={view.length > 0}
				onReload={res.reload}
				loading={res.status === 'loading'}
				density={density}
				onDensity={changeDensity}
				onShortcuts={() => setShortcuts(true)}
			/>
			{res.status === 'error' ? (
				<ErrorState error={res.error} onRetry={res.reload} />
			) : res.status === 'loading' && !res.data ? (
				<LoadingState lines={8} label="Loading records" />
			) : (
				<>
					{data.hasConflicts ? (
						<p role="alert" className="banner banner--warning sheet-banner">
							Some records changed on the server after you loaded them. Reload to see the latest values, or overwrite the server with your edits.{' '}
							<Button size="sm" onClick={() => data.save({ overwrite: true })} disabled={status === 'saving'}>
								Overwrite and save
							</Button>
						</p>
					) : null}
					{empty ? (
						<div className="sheet sheet--empty">
							<EmptyState
								icon="search"
								title={searching ? 'No rows match' : `No ${mod.title.toLowerCase()} yet`}
								message={
									searching
										? serverSearch
											? `No record's name matches “${search.trim()}”. Try a shorter term, or switch to “Loaded rows” to search every column of the rows on this page.`
											: 'No loaded row matches. Clear the search or filters to see the loaded rows.'
										: canWrite
										? 'Add a row to start entering records.'
										: 'There are no records to show.'
								}
								action={canWrite && !searching ? <Button variant="primary" icon="plus" onClick={addRow}>Add row</Button> : null}
							/>
						</div>
					) : (
						<div className="sheet" aria-busy={res.status === 'loading'}>
							<SheetGrid
								ref={gridRef}
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
								onSelection={setSelInfo}
								onDeleteRows={doDelete}
								density={density}
								storageKey={mod.resource}
							/>
						</div>
					)}
					<div className="sheet-foot">
						<span className="sheet-foot__sel" aria-live="off">
							{selInfo ? (
								<>
									<b>{selInfo.label}</b>
									{selInfo.cells > 1 ? ` · ${selInfo.cells} cells` : ''}
								</>
							) : (
								'No selection'
							)}
						</span>
						<span className="muted">
							{view.length} row{view.length === 1 ? '' : 's'} shown{res.meta ? ` of ${res.meta.total}` : ''}
							{search.trim() && !serverSearch ? ' · searching loaded rows only' : ''}
						</span>
						<span className="muted sheet-foot__hint">Type or Enter edits · Tab moves · {`Shift+Arrows`} select · Right-click for more</span>
						<Pagination meta={res.meta} onPage={setPage} />
					</div>
				</>
			)}
			{confirmDelete ? (
				<ConfirmDialog
					title={`Delete ${selectedExisting.length} record${selectedExisting.length > 1 ? 's' : ''}?`}
					message="This is applied immediately and cannot be undone here. Deleted records are removed from lists and totals; an administrator can restore them from the data store."
					onCancel={() => setConfirmDelete(false)}
					onConfirm={async () => {
						try {
							await data.deleteRecords(selectedExisting);
							notify('Records deleted');
						} catch (e) {
							notify(e.message, 'error');
						}
						setConfirmDelete(false);
					}}
				/>
			) : null}
			{shortcuts ? <SheetShortcuts onClose={() => setShortcuts(false)} /> : null}
		</div>
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
		<div className="sheet-page">
			<div className="sheet-head">
				<h1 className="sheet-head__title">Spreadsheet editor</h1>
				<DataEntryModes current="sheet" resource={mod && mod.resource} />
				{mod ? (
					<label className="sheet-head__picker">
						<span>Record type</span>
						<select value={mod.resource} onChange={(e) => setSp({ module: e.target.value }, { replace: true })}>
							{available.map((m) => (
								<option key={m.resource} value={m.resource}>
									{m.title}
								</option>
							))}
						</select>
					</label>
				) : null}
				<Popover
					label="About the spreadsheet editor"
					align="right"
					trigger={({ toggle, props }) => (
						<button type="button" className="icon-btn" aria-label="About the spreadsheet editor" title="About the spreadsheet editor" onClick={toggle} {...props}>
							<Icon name="info" size={17} />
						</button>
					)}
				>
					<div className="sheet-filter" style={{ maxWidth: 340 }}>
						<p className="small">Edit existing records and add new ones in a grid. Changes are saved to the same records as the Add form and Sheet import.</p>
						<p className="small muted">
							Columns are the fields this record type supports; new columns cannot be added because the schema is fixed. Saved values cannot be cleared, and fields that identify a record cannot be changed after it is created.
							{!canWrite && mod ? ' Only administrators can change this record type.' : ''}
						</p>
					</div>
				</Popover>
			</div>
			{templates.status === 'error' ? (
				<p role="alert" className="banner banner--error">
					The spreadsheet is unavailable: {templates.error.message}
				</p>
			) : null}
			{mod ? <Sheet key={mod.resource} mod={sheetModule(mod.resource)} template={template} canWrite={canWrite} /> : templates.status === 'loading' ? <LoadingState lines={6} label="Loading spreadsheet" /> : null}
		</div>
	);
}
