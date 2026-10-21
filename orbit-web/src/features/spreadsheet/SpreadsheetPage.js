import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import usePageSize from '../../hooks/usePageSize';
import useLookupLabels from '../../hooks/useLookup';
import useTemplates from '../../hooks/useTemplates';
import useUnsavedGuard from '../../hooks/useUnsavedGuard';
import DataEntryModes from './DataEntryModes';
import SheetFormatBar from './SheetFormatBar';
import SheetTabBar from './SheetTabBar';
import { addTab, loadStore, reconcile, removeTab, renameTab, saveStore } from './tabStore';
import useSheetFormat from './useSheetFormat';
import { EDGES, isNumericText, MAX_DECIMALS, mergeEdges, shownDecimals } from './sheetFormat';
import { applyConfig, configKey, loadConfig, saveConfig } from '../../utils/columnConfig';
import ColumnConfigDialog from './ColumnConfigDialog';
import { displayText, rowsToCsv } from './gridModel';
import SheetGrid from './SheetGrid';
import SheetShortcuts from './SheetShortcuts';
import SheetToolbar from './SheetToolbar';
import { SHEET_MODULES, sheetModule } from './spreadsheetModules';
import useSheetData from './useSheetData';
import useSheetView from './useSheetView';

const FK_COLUMNS = ['employee_id', 'reports_to_employee_id', 'assignee_employee_id', 'project_id', 'team_id', 'primary_team_id'];
const DENSITY_KEY = 'company360.sheetDensity';
const TOOLS_KEY = 'company360.sheetToolsHidden';
const PAINT_KEYS = ['b', 'i', 's', 'wrap', 'clip', 'align', 'valign', 'size', 'font', 'color', 'fill', 'nf', 'bd'];

function readToolsHidden() {
	try {
		const stored = window.localStorage.getItem(TOOLS_KEY);
		if (stored !== null) return stored === '1';
	} catch {
		/* fall through to the screen-size default */
	}
	// Nothing chosen yet: on a phone the formatting rows would fill the screen before the grid starts, so they begin collapsed.
	return typeof window !== 'undefined' && window.innerWidth < 640;
}

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

/** What the signed-in user may do with a record type, from its field contract (older servers: the legacy admin-only flag). */
const permsOf = (template, user) => {
	if (!template) return { view: false, create: false, edit: false, delete: false };
	if (template.permissions) return template.permissions;
	const write = !template.adminOnly || (user && user.role === 'admin'); // older server: the legacy admin-only flag
	return { view: true, create: write, edit: write, delete: write };
};

/** The sheet for one record type. Remounted per module so each starts clean. */
function Sheet({ tabId, mod, template, canWrite, perms, canExport, zoomPct, onZoom, onDirty }) {
	const { notify } = useToast();
	const { user } = useAuth();
	const [exportOpen, setExportOpen] = useState(false);
	// The page belongs to the query it was chosen for, so a new search always starts on page 1
	// (without first requesting the old query's page N).
	const [pageSize, setPageSize] = usePageSize('spreadsheet', 50);
	const [pageState, setPageState] = useState({ k: '', page: 1 });
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
	const pageKey = `${dsearch}|${pageSize}`; // a new query or page size starts on page 1
	const page = pageState.k === pageKey ? pageState.page : 1;
	const setPage = useCallback((p) => setPageState({ k: pageKey, page: p }), [pageKey]);

	// Device-local cell formatting (never part of a record, never sent to the API). Its changes join the
	// same undo/redo history as cell edits, so Ctrl+Z / Ctrl+Y and the toolbar undo colour and style changes too.
	const fmt = useSheetFormat(mod.resource);
	const data = useSheetData({ resource: mod.resource, template, canWrite, search: dsearch, page, pageSize, applyFormat: fmt.restore });
	const { res, rows, columns, state } = data;
	const labelOf = useLookupLabels(rows, FK_COLUMNS);
	// Typing filters the loaded rows at once (the server answer for the whole table follows after the
	// pause). Once the server has answered, its rows are shown as they are. If the server search itself
	// fails, the sheet falls back to the loaded rows instead of leaving the search dead.
	const settling = serverSearch && (search.trim() !== dsearch || res.status === 'loading');
	const view = useSheetView({ rows, state, valueOf: data.valueOf, columns, sort, filters, query: serverSearch && !settling ? '' : search, labelOf });
	const searchFailed = serverSearch && dsearch !== '' && res.status === 'error';
	useEffect(() => {
		if (!searchFailed) return;
		setScope('loaded');
		notify('Searching all records is unavailable right now. Searching the rows loaded in the grid instead.', 'error');
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchFailed]);
	useEffect(() => {
		if (!data.columnNotice) return;
		notify(data.columnNotice, 'error');
		data.clearColumnNotice();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [data.columnNotice]);
	useEffect(() => {
		onDirty(tabId, data.dirtyCount); // the page guards unsaved work across every open sheet
	}, [onDirty, tabId, data.dirtyCount]);

	const cellsOf = () => (gridRef.current ? gridRef.current.selectedCells() : []);
	const fmtOf = (c) => (fmt.formats[c.key] || {})[c.field] || {};
	const activeFmt = selInfo && selInfo.active ? fmtOf(selInfo.active) : null;
	const record = (changes) => {
		if (changes.length) data.recordFormat(changes);
	};
	const setFmt = (patch) => {
		const cells = cellsOf();
		if (cells.length) record(fmt.apply(cells, patch));
	};
	const toggleFmt = (prop) => {
		const cells = cellsOf();
		if (!cells.length) return;
		const on = cells.every((c) => fmtOf(c)[prop]);
		record(fmt.apply(cells, { [prop]: on ? null : true }));
	};
	const clearFmt = () => {
		const cells = cellsOf();
		if (cells.length) record(fmt.clear(cells));
	};
	// Applies one patch per distinct value, so cells that need different results still share one undo step.
	const applyGrouped = (entries) => {
		const groups = new Map();
		for (const { cell, patch } of entries) {
			const k = JSON.stringify(patch);
			if (!groups.has(k)) groups.set(k, { patch, cells: [] });
			groups.get(k).cells.push(cell);
		}
		record([...groups.values()].flatMap((g) => fmt.apply(g.cells, g.patch)));
	};
	const rowByKey = () => new Map(view.map((r) => [r.key, r]));
	const colByField = () => new Map(columns.map((c) => [c.field, c]));
	const shownText = (rows, cols, c) => {
		const r = rows.get(c.key);
		const col = cols.get(c.field);
		return r && col ? displayText(col, r.values[c.field], labelOf) : '';
	};
	const changeDecimals = (delta) => {
		const rows = rowByKey();
		const cols = colByField();
		const entries = [];
		for (const c of cellsOf()) {
			const f = fmtOf(c);
			const text = shownText(rows, cols, c);
			if (!isNumericText(text)) continue;
			const d = Math.min(MAX_DECIMALS, Math.max(0, shownDecimals(text, f.nf) + delta));
			entries.push({ cell: c, patch: { nf: { t: f.nf && f.nf.t !== 'text' ? f.nf.t : 'auto', d } } });
		}
		applyGrouped(entries);
	};
	const changeBorders = (kind) => {
		const cells = cellsOf();
		if (!cells.length) return;
		const rowIdx = new Map(view.map((r, i) => [r.key, i]));
		const colIdx = new Map(columns.map((c, i) => [c.field, i]));
		const rs = cells.map((c) => rowIdx.get(c.key));
		const cs = cells.map((c) => colIdx.get(c.field));
		const [r0, r1, c0, c1] = [Math.min(...rs), Math.max(...rs), Math.min(...cs), Math.max(...cs)];
		const entries = cells.map((c) => {
			if (kind === 'none') return { cell: c, patch: { bd: null } };
			const r = rowIdx.get(c.key);
			const k = colIdx.get(c.field);
			const edges = kind === 'all' ? EDGES.join('') : EDGES.filter((e) => (kind === 'outer' || kind === e) && ((e === 't' && r === r0) || (e === 'b' && r === r1) || (e === 'l' && k === c0) || (e === 'r' && k === c1) || kind === 'all')).join('');
			return { cell: c, patch: edges ? { bd: mergeEdges(fmtOf(c).bd, edges) } : {} };
		});
		applyGrouped(entries.filter((e) => Object.keys(e.patch).length));
	};
	const [calc, setCalc] = useState(null);
	const selText = selInfo ? selInfo.label : '';
	useEffect(() => {
		setCalc(null); // a result belongs to the selection it was computed for
	}, [selText]);
	const runFunction = (name) => {
		const rows = rowByKey();
		const cols = colByField();
		const nums = cellsOf()
			.map((c) => shownText(rows, cols, c).replace(/,/g, '').trim())
			.filter(isNumericText)
			.map(Number);
		const label = name.toUpperCase();
		if (!nums.length) return setCalc({ label, text: name === 'count' ? '0' : 'no numbers in the selection' });
		const sum = nums.reduce((a, b) => a + b, 0);
		const value = { sum, average: sum / nums.length, count: nums.length, max: Math.max(...nums), min: Math.min(...nums) }[name];
		setCalc({ label, text: Number(value.toFixed(4)).toLocaleString('en-GB') });
	};

	// Paint format: copy the active cell's look, then apply it to the next selection once the pointer is released.
	const [painter, setPainter] = useState(null);
	const selLabel = useRef('');
	selLabel.current = selText;
	const setFmtRef = useRef(setFmt);
	setFmtRef.current = setFmt;
	useEffect(() => {
		if (!painter) return undefined;
		const done = () =>
			setTimeout(() => {
				if (selLabel.current === painter.from) return;
				setFmtRef.current(Object.fromEntries(PAINT_KEYS.map((k) => [k, painter.fmt[k] ?? null])));
				setPainter(null);
			}, 0);
		document.addEventListener('pointerup', done);
		return () => document.removeEventListener('pointerup', done);
	}, [painter]);
	const startPaint = () => {
		if (painter) return setPainter(null);
		if (activeFmt && selInfo) setPainter({ fmt: activeFmt, from: selInfo.label });
	};
	const [toolsHidden, setToolsHidden] = useState(readToolsHidden);
	const hideTools = (hidden) => {
		setToolsHidden(hidden);
		try {
			window.localStorage.setItem(TOOLS_KEY, hidden ? '1' : '0');
		} catch {
			/* the choice is just not remembered */
		}
	};

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
		if (selectedExisting.length && perms.delete) setConfirmDelete(true); // deleting saved records needs the Delete permission
	};

	// Create lets you add rows; Edit lets you change saved records. Without Edit, saved cells stay as they are.
	const setCells = (changes) => {
		if (perms.edit) return data.setCells(changes);
		const own = changes.filter((c) => c.key.startsWith('n:'));
		const refused = changes.filter((c) => !c.key.startsWith('n:')).map((c) => ({ key: c.key, field: c.field, reason: 'You do not have permission to change saved records' }));
		const out = own.length ? data.setCells(own) : { applied: [], rejected: [] };
		return { ...out, rejected: [...(out.rejected || []), ...refused] };
	};

	const dataColumns = columns.filter((c) => !c.placeholder);
	const exportRows = view.filter((r) => !r.pristine);
	const colKey = configKey(user && (user.id || user.email), mod.resource, 'export');
	const exportCsv = () => setExportOpen(true);
	const downloadExport = ({ config, headers, remember }) => {
		if (remember) saveConfig(colKey, config, dataColumns);
		download(`${mod.resource}.csv`, rowsToCsv(applyConfig(config, dataColumns), exportRows, (r, f) => r.values[f], { headers }));
		setExportOpen(false);
	};
	const sortCol = sort && columns.find((c) => c.field === sort.field);
	const { status } = data.saveState;
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

	// Name box + formula bar (read-only mirror of the active cell; typing happens in the cell itself).
	const activeRow = selInfo && selInfo.active ? view.find((r) => r.key === selInfo.active.key) : null;
	const activeCol = selInfo && selInfo.active ? columns.find((c) => c.field === selInfo.active.field) : null;
	const activeText = activeRow && activeCol ? displayText(activeCol, activeRow.values[activeCol.field], labelOf) : '';

	const searching = search.trim() !== '' || filters.length > 0;
	const empty = false; // the grid is always a blank sheet to type into

	return (
		<div className="sheet-workspace" onKeyDown={onWorkspaceKeyDown}>
			{exportOpen ? <ColumnConfigDialog columns={dataColumns} initial={loadConfig(colKey, dataColumns)} previewRows={exportRows} getValue={(r, f) => r.values[f]} rowCount={exportRows.length} onConfirm={downloadExport} onClose={() => setExportOpen(false)} /> : null}
			<SheetToolbar
				ref={searchRef}
				title={mod.title}
				canWrite={canWrite}
				status={saveStatus}
				dirtyCount={data.dirtyCount}
				saving={status === 'saving'}
				onSave={save}
				onDiscard={data.discard}
				onCut={() => gridRef.current && gridRef.current.cut()}
				onCopy={() => gridRef.current && gridRef.current.copy()}
				onPaste={() => gridRef.current && gridRef.current.paste()}
				canDelete={perms.delete && selectedViewRows.length > 0}
				onDelete={doDelete}
				search={search}
				onSearch={setSearch}
				searchLabel={serverSearch ? mod.search : 'Search loaded rows'}
				searchScope={scope}
				onSearchScope={setScope}
				canServerSearch={Boolean(mod.search)}
				sortLabel={sortCol ? `${sortCol.label} ${sort.dir === 'asc' ? '↑' : '↓'}` : null}
				onClearSort={() => setSort(null)}
				onExport={exportCsv}
				canExport={canExport && view.length > 0}
				onReload={res.reload}
				loading={res.status === 'loading'}
				density={density}
				onDensity={changeDensity}
				onShortcuts={() => setShortcuts(true)}
			/>
			<SheetFormatBar
				resource={mod.resource}
				fmt={activeFmt}
				hasSelection={Boolean(selInfo)}
				canWrite={canWrite}
				canUndo={data.canUndo}
				canRedo={data.canRedo}
				onUndo={data.undo}
				onRedo={data.redo}
				onSearch={() => {
					if (searchRef.current) {
						searchRef.current.focus();
						searchRef.current.select();
					}
				}}
				onPrint={() => window.print()}
				painting={Boolean(painter)}
				onPaint={startPaint}
				onSet={setFmt}
				onToggle={toggleFmt}
				onClearFormat={clearFmt}
				onDecimals={changeDecimals}
				onBorders={changeBorders}
				onFunction={runFunction}
				columns={dataColumns}
				filters={filters}
				onFilters={setFilters}
				zoomPct={zoomPct}
				onZoom={onZoom}
				collapsed={toolsHidden}
				onCollapse={hideTools}
			/>
			<div className="sheet-formula">
				<span className="sheet-formula__name" title="Selected cell">
					{selInfo ? selInfo.label : ''}
				</span>
				<span className="sheet-formula__fx" aria-hidden="true">
					<i>f</i>
					<i>x</i>
				</span>
				<span className="sheet-formula__value" title={activeText || undefined}>
					{activeText}
				</span>
			</div>
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
								action={perms.create && !searching ? <Button variant="primary" icon="plus" onClick={addRow}>Add row</Button> : null}
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
								canAddRows={perms.create}
								onSetCells={setCells}
								onAddRows={perms.create ? data.addRows : undefined}
								onRenameColumn={data.canAddColumns ? data.renameColumn : undefined}
								onNotice={onNotice}
								onUndo={data.undo}
								onRedo={data.redo}
								sort={sort}
								onSort={toggleSort}
								onSelectRows={setSelected}
								onSelection={setSelInfo}
								onDeleteRows={perms.delete ? doDelete : undefined}
								density={density}
								storageKey={mod.resource}
								formats={fmt.formats}
								zoom={zoomPct / 100}
								onZoom={onZoom}
								onFormatShortcut={(kind) => toggleFmt(kind === 'bold' ? 'b' : 'i')}
							/>
						</div>
					)}
					<div className="sheet-foot">
						<span className="sheet-foot__sel" aria-live="off">
							{selInfo ? (selInfo.cells > 1 ? `${selInfo.cells} cells selected` : '') : 'No selection'}
						</span>
						{calc ? (
							<span className="sheet-foot__calc" role="status">
								<b>{calc.label}</b> {calc.text}
							</span>
						) : null}
						<span className="muted">
							{view.filter((r) => !r.pristine).length} row{view.filter((r) => !r.pristine).length === 1 ? '' : 's'} shown{res.meta ? ` of ${res.meta.total}` : ''}
							{search.trim() && !serverSearch ? ' · searching loaded rows only' : ''}
						</span>
						<span className="muted sheet-foot__hint">Type or Enter edits · Tab moves · {`Shift+Arrows`} select · Right-click for more</span>
						<Pagination meta={res.meta} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />
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

const ZOOM_KEY = 'company360.sheetZoom';
function readZoom() {
	try {
		const n = Number(window.localStorage.getItem(ZOOM_KEY));
		return n >= 50 && n <= 200 ? n : 100;
	} catch {
		return 100;
	}
}

/** Spreadsheet editor: the third way to enter data, next to the Add form and Sheet import. */
export default function SpreadsheetPage() {
	const { user, can } = useAuth();
	const templates = useTemplates();
	const [sp, setSp] = useSearchParams();
	const available = useMemo(() => SHEET_MODULES.filter((m) => templates.byModule[m.resource]), [templates.byModule]);
	const availableIds = useMemo(() => available.map((m) => m.resource), [available]);
	const wanted = sp.get('module');
	const ready = Boolean(templates.data);

	// Tabs: every open sheet is its own record-type sheet. Only ids/types/names are remembered (this device).
	const [store, setStore] = useState(loadStore);
	useEffect(() => {
		if (ready) setStore((s) => reconcile(s, availableIds, wanted));
	}, [ready, availableIds, wanted]);
	useEffect(() => {
		saveStore(store);
	}, [store]);
	const tabs = useMemo(() => store.tabs.filter((t) => availableIds.includes(t.resource)).map((t) => ({ ...t, title: sheetModule(t.resource).title })), [store.tabs, availableIds]);
	const activeId = tabs.some((t) => t.id === store.active) ? store.active : tabs[0] && tabs[0].id;

	// A tab's pane mounts the first time it is shown and then stays mounted (hidden), so unsaved edits,
	// selection, search and sort survive switching tabs. Unvisited tabs cost no requests.
	const [visited, setVisited] = useState(() => new Set());
	useEffect(() => {
		if (activeId) setVisited((v) => (v.has(activeId) ? v : new Set(v).add(activeId)));
	}, [activeId]);

	const [dirty, setDirty] = useState({});
	const onDirty = useCallback((id, n) => setDirty((d) => (d[id] === n ? d : { ...d, [id]: n })), []);
	useUnsavedGuard(Object.values(dirty).reduce((a, b) => a + b, 0) > 0);

	const [zoomPct, setZoom] = useState(readZoom);
	const onZoom = useCallback((pct) => {
		setZoom(pct);
		try {
			window.localStorage.setItem(ZOOM_KEY, String(pct));
		} catch {
			/* zoom just is not remembered */
		}
	}, []);

	const select = (id) => {
		const t = tabs.find((x) => x.id === id);
		if (!t) return;
		setStore((s) => ({ ...s, active: id }));
		setSp({ module: t.resource }, { replace: true }); // the URL follows the sheet you are on
	};
	const add = (resource) => {
		setStore((s) => addTab(s, resource));
		setSp({ module: resource }, { replace: true });
	};
	const [closing, setClosing] = useState(null);
	const doClose = (id) => {
		setStore((s) => removeTab(s, id));
		setDirty((d) => {
			const { [id]: _gone, ...rest } = d;
			return rest;
		});
		setVisited((v) => {
			const n = new Set(v);
			n.delete(id);
			return n;
		});
		setClosing(null);
	};
	const requestClose = (id) => (dirty[id] > 0 ? setClosing(id) : doClose(id));

	const activeTab = tabs.find((t) => t.id === activeId);
	const activeTemplate = activeTab ? templates.byModule[activeTab.resource] : null;
	const activePerms = permsOf(activeTemplate, user);
	const activeCanWrite = activePerms.create || activePerms.edit;
	const mounted = tabs.filter((t) => t.id === activeId || visited.has(t.id));
	const closingTab = tabs.find((t) => t.id === closing);

	return (
		<div className="sheet-page">
			<div className="sheet-head">
				<h1 className="sheet-head__title">Spreadsheet editor</h1>
				<DataEntryModes current="sheet" resource={activeTab && activeTab.resource} />
				<span className="sheet-head__spacer" />
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
							Columns are the fields this record type supports, plus any extra columns an administrator adds (type a name in a blank column header). Saved values of built-in fields cannot be cleared, and fields that identify a record cannot be changed after it is created. Use the + tabs below to open more sheets.
							{activeTab && !activeCanWrite ? ' Your role cannot change this record type.' : ''}
						</p>
						<p className="small muted">Cell formatting (colours, bold, links, zoom) is remembered in this browser only; it is not part of the record.</p>
					</div>
				</Popover>
			</div>
			{templates.status === 'error' ? (
				<p role="alert" className="banner banner--error">
					The spreadsheet is unavailable: {templates.error.message}
				</p>
			) : null}
			{activeTab ? (
				<>
					<div className="sheet-panes">
						{mounted.map((t) => {
							const template = templates.byModule[t.resource];
							const perms = permsOf(template, user);
							const canWrite = perms.create || perms.edit;
							return (
								<div key={t.id} id={`sheet-pane-${t.id}`} role="tabpanel" aria-labelledby={`sheet-tab-${t.id}`} className="sheet-pane" hidden={t.id !== activeId}>
									<Sheet tabId={t.id} mod={sheetModule(t.resource)} template={template} canWrite={canWrite} perms={perms} canExport={can('spreadsheet.export')} zoomPct={zoomPct} onZoom={onZoom} onDirty={onDirty} />
								</div>
							);
						})}
					</div>
					<SheetTabBar tabs={tabs} activeId={activeId} dirty={dirty} modules={available} onSelect={select} onAdd={add} onRename={(id, name) => setStore((s) => renameTab(s, id, name))} onClose={requestClose} />
				</>
			) : templates.status === 'loading' ? (
				<LoadingState lines={6} label="Loading spreadsheet" />
			) : null}
			{closingTab ? (
				<ConfirmDialog
					title={`Close ${closingTab.name}?`}
					message="This sheet has unsaved changes. Closing it discards them."
					confirmLabel="Close and discard"
					onCancel={() => setClosing(null)}
					onConfirm={() => doClose(closingTab.id)}
				/>
			) : null}
		</div>
	);
}
