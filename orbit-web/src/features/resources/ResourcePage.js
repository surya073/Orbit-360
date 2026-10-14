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
import { PAGE_SIZE } from '../../config/constants';
import { ROUTES } from '../../config/routes';
import useApiResource from '../../hooks/useApiResource';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import useLookupLabels from '../../hooks/useLookup';
import useTemplates from '../../hooks/useTemplates';
import { resourceService } from '../../services/resourceService';
import { humanize } from '../../utils/format';
import ModuleSummary from './ModuleSummary';
import { renderCell } from './renderCell';

/**
 * Standard module page: header, optional summary, filters, searchable paginated table, and
 * create/edit/delete in dialogs. Driven by a config object; features add behaviour through
 * `rowExtras(row, helpers)` (extra row buttons), `topSlot` (widgets above the filters) and
 * `extraFilters`. Write controls are hidden when the backend contract is unavailable or the role
 * cannot write (UX only: the backend enforces both).
 */
export default function ResourcePage({ config, rowExtras, topSlot, extraFilters }) {
	const { resource } = config;
	const { user } = useAuth();
	const { notify } = useToast();
	const [sp, setSp] = useSearchParams();
	const urlQ = sp.get('q') || '';

	const [page, setPage] = useState(1);
	const [filters, setFilters] = useState({});
	const [q, setQ] = useState(urlQ);
	const [dialog, setDialog] = useState(null); // { type: 'form', initial? } | { type: 'delete', row }
	const dq = useDebouncedValue(q, 350);
	const templates = useTemplates();

	// A search-palette jump (?q=) while already on this page updates the search box.
	useEffect(() => {
		setQ(urlQ);
		setPage(1);
	}, [urlQ]);

	const params = useMemo(() => ({ page, pageSize: PAGE_SIZE, q: dq, ...filters }), [page, dq, filters]);
	const res = useApiResource((signal) => resourceService.list(resource, params, { signal }), `${resource}|${JSON.stringify(params)}`, { isEmpty: () => false });
	const labelOf = useLookupLabels(res.data, config.fkColumns);

	const template = templates.byModule[resource];
	const canWrite = Boolean(config.writable && template && (!config.adminWrite || user.role === 'admin'));
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

	const act = useCallback(
		async (fn, success) => {
			try {
				await fn();
				notify(success);
				res.reload();
			} catch (e) {
				notify(e.message, 'error');
			}
		},
		[notify, res]
	);

	const actions = (row) => (
		<>
			{rowExtras ? rowExtras(row, { act, reload: res.reload }) : null}
			{canWrite && config.approvals && row.approval_status !== 'approved' ? (
				<Button size="sm" onClick={() => act(() => resourceService.decideTimeEntry(row.ROWID, 'approved'), 'Entry approved')}>
					Approve
				</Button>
			) : null}
			{canWrite && config.approvals && row.approval_status !== 'rejected' ? (
				<Button size="sm" onClick={() => act(() => resourceService.decideTimeEntry(row.ROWID, 'rejected'), 'Entry rejected')}>
					Reject
				</Button>
			) : null}
			{canWrite ? (
				<>
					<Button size="sm" variant="ghost" icon="edit" aria-label={`Edit record ${row.ROWID}`} onClick={() => setDialog({ type: 'form', initial: row })}>
						Edit
					</Button>
					<Button size="sm" variant="ghost" icon="trash" aria-label={`Delete record ${row.ROWID}`} onClick={() => setDialog({ type: 'delete', row })}>
						Delete
					</Button>
				</>
			) : null}
		</>
	);
	const hasActions = canWrite || Boolean(rowExtras);

	return (
		<>
			<PageHeader
				title={config.title}
				description={config.description}
				actions={
					<>
						{canWrite ? (
							<Button variant="primary" icon="plus" onClick={openCreate}>
								{config.addLabel || 'Add record'}
							</Button>
						) : null}
						{config.importable ? (
							<Button icon="upload" to={ROUTES.imports}>
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
			{config.summary ? <ModuleSummary kind={config.summary} from={filters.from} to={filters.to} /> : null}
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
							<select {...p} value={filters[f.key] || ''} onChange={setFilter(f.key)}>
								<option value="">All</option>
								{f.options.map((o) => (
									<option key={o} value={o}>
										{humanize(o)}
									</option>
								))}
							</select>
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

			<StateView res={res} loadingLines={6}>
				{rows.length === 0 ? (
					<EmptyState
						icon="search"
						title={filtered ? 'No records match your filters' : `No ${config.title.toLowerCase()} yet`}
						message={filtered ? 'Try different search terms or clear the filters.' : config.emptyMessage || 'Add a record or import data to get started.'}
						action={
							filtered ? (
								<Button onClick={clearAll}>Clear filters</Button>
							) : canWrite ? (
								<Button variant="primary" icon="plus" onClick={openCreate}>
									{config.addLabel || 'Add record'}
								</Button>
							) : null
						}
					/>
				) : (
					<>
						<div style={{ opacity: res.status === 'loading' ? 0.6 : 1, transition: 'opacity var(--dur) var(--ease)' }} aria-busy={res.status === 'loading'}>
							<DataTable caption={config.title} columns={config.columns.map((c) => ({ key: c.key, label: c.label, render: (row) => renderCell(c, row, labelOf) }))} rows={rows} rowActions={hasActions ? actions : undefined} />
						</div>
						<Pagination meta={res.meta} onPage={setPage} />
					</>
				)}
			</StateView>

			{dialog && dialog.type === 'form' && canWrite ? (
				<Modal title={dialog.initial ? `Edit ${config.singular || 'record'}` : `New ${config.singular || 'record'}`} onClose={closeDialog} size="lg">
					<ResourceForm
						resource={resource}
						template={template}
						initial={dialog.initial}
						onCancel={closeDialog}
						onSaved={(_, editing) => {
							closeDialog();
							notify(editing ? 'Changes saved' : 'Record created');
							res.reload();
						}}
					/>
				</Modal>
			) : null}
			{dialog && dialog.type === 'delete' ? (
				<ConfirmDialog
					title={`Delete this ${config.singular || 'record'}?`}
					message="It is removed from lists and totals. An administrator can restore it from the data store."
					onCancel={closeDialog}
					onConfirm={async () => {
						await resourceService.remove(resource, dialog.row.ROWID);
						closeDialog();
						notify('Record deleted');
						res.reload();
					}}
				/>
			) : null}
		</>
	);
}
