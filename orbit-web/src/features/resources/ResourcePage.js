import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import Button from '../../components/common/Button';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/feedback/EmptyState';
import StateView from '../../components/feedback/StateView';
import { useToast } from '../../components/feedback/ToastProvider';
import FilterBar from '../../components/filters/FilterBar';
import SearchInput from '../../components/filters/SearchInput';
import Field from '../../components/forms/Field';
import ResourceForm from '../../components/forms/ResourceForm';
import PageHeader from '../../components/layout/PageHeader';
import DataTable from '../../components/tables/DataTable';
import Pagination from '../../components/tables/Pagination';
import useBentoReveal from '../../hooks/useBentoReveal';
import usePageSize from '../../hooks/usePageSize';
import { SHEET_MODULES } from '../spreadsheet/spreadsheetModules';
import { keyOf, moduleOfResource } from '../../config/permissions';
import { ROUTES } from '../../config/routes';
import useApiResource from '../../hooks/useApiResource';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import useLookupLabels from '../../hooks/useLookup';
import useTemplates from '../../hooks/useTemplates';
import { resourceService } from '../../services/resourceService';
import { humanize } from '../../utils/format';
import ModuleSummary from './ModuleSummary';
import { renderCell } from './renderCell';
import Select from '../../components/forms/Select';
import Icon from '../../components/common/Icon';

/** Simple English plural for the record-count chip ("time entry" -> "time entries"). */
const plural = (n) => (/[^aeiou]y$/.test(n) ? `${n.slice(0, -1)}ies` : /(s|x|ch|sh)$/.test(n) ? `${n}es` : `${n}s`);

/**
 * Standard module page: header, optional summary, filters, searchable paginated table, and
 * create/edit/delete in dialogs. Driven by a config object; features add behaviour through
 * `rowExtras(row, helpers)` (extra row buttons), `topSlot` (widgets above the filters) and
 * `extraFilters`. Write controls are hidden when the backend contract is unavailable or the user's role
 * lacks the matching permission (UX only: the backend enforces both).
 */
export default function ResourcePage({ config, rowExtras, topSlot, extraFilters, ViewCard, GridCard }) {
	const { resource } = config;
	const { can } = useAuth();
	const { notify } = useToast();
	const [sp, setSp] = useSearchParams();
	const urlQ = sp.get('q') || '';

	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = usePageSize(resource);
	const [filters, setFilters] = useState({});
	const [q, setQ] = useState(urlQ);
	// Modules that offer a card layout remember the chosen layout per device.
	const viewKey = `company360.view.${resource}`;
	const [layout, setLayoutState] = useState(() => {
		try {
			const saved = window.localStorage.getItem(viewKey);
			// phones have no room for a wide table (its row actions fall off-screen): cards are the default there
			if (!saved) return window.matchMedia && window.matchMedia('(max-width: 640px)').matches ? 'cards' : 'list';
			return saved === 'cards' ? 'cards' : 'list';
		} catch {
			return 'list';
		}
	});
	const setLayout = (v) => {
		setLayoutState(v);
		try {
			window.localStorage.setItem(viewKey, v);
		} catch {
			/* private mode: the choice just lasts this visit */
		}
	};
	const [dialog, setDialog] = useState(null); // { type: 'form', initial? } | { type: 'delete', row }
	const dq = useDebouncedValue(q, 350).trim(); // surrounding spaces never start a new request
	const templates = useTemplates();

	// A search-palette jump (?q=) while already on this page updates the search box.
	useEffect(() => {
		setQ(urlQ);
		setPage(1);
	}, [urlQ]);

	const params = useMemo(() => ({ page, pageSize, q: dq, ...filters }), [page, pageSize, dq, filters]);
	const res = useApiResource((signal) => resourceService.list(resource, params, { signal }), `${resource}|${JSON.stringify(params)}`, { isEmpty: () => false });
	const labelOf = useLookupLabels(res.data, config.fkColumns);
	// After a write the list reloads and so do the summary cards above it, so their numbers never lag behind the table (one extra request).
	const [summaryVersion, setSummaryVersion] = useState(0);
	const { reload: reloadList } = res;
	const reloadAfterWrite = useCallback(() => {
		reloadList();
		setSummaryVersion((v) => v + 1);
	}, [reloadList]);
	useBentoReveal('.mod', [res.status === 'loading' ? 'l' : 'r', layout], '.mod .card, .mod .table-wrap, .mod .hgrid');

	const template = templates.byModule[resource];
	// Each control follows its own permission (Create / Edit / Delete / Approve), not one all-or-nothing flag.
	const module = moduleOfResource(resource);
	const allowed = (action) => Boolean(config.writable && template && module && can(keyOf(module, action)));
	const canCreate = allowed('create');
	const canEdit = allowed('edit');
	const canDelete = allowed('delete');
	const canApprove = Boolean(config.approvals && can('time_entries.approve'));
	const rows = res.data || [];
	const filtered = Boolean(dq || Object.values(filters).some(Boolean));

	const setFilter = (key) => (e) => {
		setPage(1);
		setFilters((f) => ({ ...f, [key]: e.target.value }));
	};
	const onSearch = (v) => {
		setQ(v);
		setPage(1);
	};
	const clearAll = () => {
		setQ('');
		setFilters({});
		setPage(1);
		if (urlQ) setSp({}, { replace: true });
	};
	const closeDialog = () => setDialog(null);
	const openCreate = () => setDialog({ type: 'form' });

	// "Add form" in the data-entry options links here with ?new=1 to open the create dialog.
	const wantsNew = sp.get('new') === '1';
	useEffect(() => {
		if (!wantsNew || !canCreate) return;
		setDialog({ type: 'form' });
		setSp((p) => {
			p.delete('new');
			return p;
		}, { replace: true });
	}, [wantsNew, canCreate, setSp]);

	const act = useCallback(
		async (fn, success) => {
			try {
				await fn();
				notify(success);
				reloadAfterWrite();
			} catch (e) {
				notify(e.message, 'error');
			}
		},
		[notify, reloadAfterWrite]
	);

	const actions = (row) => (
		<>
			{rowExtras ? rowExtras(row, { act, reload: res.reload }) : null}
			{canApprove && row.approval_status !== 'approved' ? (
				<Button size="sm" onClick={() => act(() => resourceService.decideTimeEntry(row.ROWID, 'approved'), 'Entry approved')}>
					Approve
				</Button>
			) : null}
			{canApprove && row.approval_status !== 'rejected' ? (
				<Button size="sm" onClick={() => act(() => resourceService.decideTimeEntry(row.ROWID, 'rejected'), 'Entry rejected')}>
					Reject
				</Button>
			) : null}
			{ViewCard ? (
				<Button size="sm" variant="ghost" icon="search" aria-label={`View ${row.full_name || row.name || `record ${row.ROWID}`}`} onClick={() => setDialog({ type: 'view', row })}>
					{config.viewLabel || 'View'}
				</Button>
			) : null}
			{canEdit ? (
				<Button size="sm" variant="ghost" icon="edit" aria-label={`Edit record ${row.ROWID}`} onClick={() => setDialog({ type: 'form', initial: row })}>
					Edit
				</Button>
			) : null}
			{canDelete ? (
				<Button size="sm" variant="ghost" icon="trash" aria-label={`Delete record ${row.ROWID}`} onClick={() => setDialog({ type: 'delete', row })}>
					Delete
				</Button>
			) : null}
		</>
	);
	const hasActions = canEdit || canDelete || canApprove || Boolean(rowExtras) || Boolean(ViewCard);

	const total = res.meta && Number.isFinite(res.meta.total) ? res.meta.total : null;
	const noun = config.singular || 'record';
	return (
		<div className="mod">
			<PageHeader
				title={config.title}
				description={config.description}
				meta={total !== null ? <span className="mod-count">{`${total} ${total === 1 ? noun : plural(noun)}${filtered ? ' match' : ''}`}</span> : undefined}
				actions={
					<>
						{canCreate ? (
							<Button variant="primary" icon="plus" onClick={openCreate}>
								{config.addLabel || 'Add record'}
							</Button>
						) : null}
						{(canCreate || canEdit) && can('spreadsheet.view') && SHEET_MODULES.some((m) => m.resource === resource) ? (
							<Button icon="edit" to={`${ROUTES.spreadsheet}?module=${resource}`}>
								Spreadsheet
							</Button>
						) : null}
						{config.importable && can('imports.view') && canCreate ? (
							<Button icon="upload" to={`${ROUTES.imports}?module=${resource}`}>
								Import
							</Button>
						) : null}
					</>
				}
			/>
			{config.note ? (
				<p className="banner banner--info" role="note">
					{config.note}
				</p>
			) : null}
			{config.writable && templates.status === 'error' ? (
				<p role="alert" className="banner banner--error">
					The entry form is unavailable: {templates.error.message}
				</p>
			) : null}
			{config.summary ? <ModuleSummary kind={config.summary} from={filters.from} to={filters.to} version={summaryVersion} /> : null}
			{topSlot}

			<FilterBar label={`Filter ${config.title}`}>
				{config.search ? <SearchInput label={config.search} value={q} onChange={onSearch} /> : null}
				{config.dateRange ? (
					<>
						<Field label="From">{(p) => <input {...p} type="date" value={filters.from || ''} max={filters.to || undefined} onChange={setFilter('from')} />}</Field>
						<Field label="To" error={filters.from && filters.to && filters.to < filters.from ? 'Before the start date' : undefined}>
							{(p) => <input {...p} type="date" value={filters.to || ''} min={filters.from || undefined} onChange={setFilter('to')} />}
						</Field>
					</>
				) : null}
				{config.filters.map((f) => (
					<Field key={f.key} label={f.label}>
						{(p) => (
							<Select {...p} value={filters[f.key] || ''} onChange={setFilter(f.key)}>
								<option value="">All</option>
								{f.options.map((o) => (
									<option key={o} value={o}>
										{humanize(o)}
									</option>
								))}
							</Select>
						)}
					</Field>
				))}
				{extraFilters}
				{filtered ? (
					<Button variant="ghost" onClick={clearAll}>
						Clear filters
					</Button>
				) : null}
			</FilterBar>

			{GridCard ? (
				<div className="view-bar">
					<div className="view-toggle" role="group" aria-label="Layout">
						<button type="button" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}>
							<Icon name="menu" size={14} /> List
						</button>
						<button type="button" aria-pressed={layout === 'cards'} onClick={() => setLayout('cards')}>
							<Icon name="dashboard" size={14} /> Cards
						</button>
					</div>
				</div>
			) : null}
			<StateView res={res} loadingLines={6}>
				{rows.length === 0 ? (
					<EmptyState
						icon="search"
						title={filtered ? 'No records match your filters' : `No ${config.title.toLowerCase()} yet`}
						message={filtered ? 'Try different search terms or clear the filters.' : config.emptyMessage || 'Add a record or import data to get started.'}
						action={
							filtered ? (
								<Button onClick={clearAll}>Clear filters</Button>
							) : canCreate ? (
								<Button variant="primary" icon="plus" onClick={openCreate}>
									{config.addLabel || 'Add record'}
								</Button>
							) : null
						}
					/>
				) : (
					<>
						<div className={`mod-body ${res.status === 'loading' ? 'is-loading' : ''}`.trim()} aria-busy={res.status === 'loading'}>
							{GridCard && layout === 'cards' ? (
								<div className="hgrid" role="list" aria-label={config.title}>
									{rows.map((row) => (
										<div key={row.ROWID} role="listitem">
											<GridCard row={row} labelOf={labelOf} actions={hasActions ? actions(row) : null} />
										</div>
									))}
								</div>
							) : (
								<DataTable caption={config.title} columns={config.columns.map((c) => ({ key: c.key, label: c.label, render: (row) => renderCell(c, row, labelOf) }))} rows={rows} rowActions={hasActions ? actions : undefined} />
							)}
						</div>
						<Pagination meta={res.meta} onPage={setPage} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
					</>
				)}
			</StateView>

			{dialog && dialog.type === 'form' && (dialog.initial ? canEdit : canCreate) ? (
				<Modal title={dialog.initial ? `Edit ${config.singular || 'record'}` : `New ${config.singular || 'record'}`} onClose={closeDialog} size="lg">
					<ResourceForm
						resource={resource}
						template={template}
						initial={dialog.initial}
						onCancel={closeDialog}
						onSaved={(_, editing) => {
							closeDialog();
							notify(editing ? 'Changes saved' : 'Record created');
							reloadAfterWrite();
						}}
					/>
				</Modal>
			) : null}
			{dialog && dialog.type === 'view' && ViewCard ? (
				<ViewCard row={dialog.row} labelOf={labelOf} canEdit={canEdit} onClose={closeDialog} onEdit={() => setDialog({ type: 'form', initial: dialog.row })} />
			) : null}
			{dialog && dialog.type === 'delete' && canDelete ? (
				<ConfirmDialog
					title={`Delete this ${config.singular || 'record'}?`}
					message="It is removed from lists and totals. An administrator can restore it from the data store."
					onCancel={closeDialog}
					onConfirm={async () => {
						await resourceService.remove(resource, dialog.row.ROWID);
						closeDialog();
						notify('Record deleted');
						reloadAfterWrite();
					}}
				/>
			) : null}
		</div>
	);
}
