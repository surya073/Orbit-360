import React, { useState } from 'react';
import Button from '../../components/common/Button';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import StatusBadge from '../../components/common/StatusBadge';
import StateView from '../../components/feedback/StateView';
import { useToast } from '../../components/feedback/ToastProvider';
import PageHeader from '../../components/layout/PageHeader';
import DataTable from '../../components/tables/DataTable';
import Pagination from '../../components/tables/Pagination';
import { ROUTES } from '../../config/routes';
import useApiResource from '../../hooks/useApiResource';
import useLookupLabels from '../../hooks/useLookup';
import { presentationsService } from '../../services/presentationsService';
import { formatDateTime } from '../../utils/dates';
import { EMPTY } from '../../utils/format';

const FK = ['team_id'];

/** Saved executive presentations the caller may open: their team's (managers) or all (admins). */
export default function PresentationsPage() {
	const { notify } = useToast();
	const [page, setPage] = useState(1);
	const [target, setTarget] = useState(null);
	const res = useApiResource((signal) => presentationsService.list({ page, pageSize: 25 }, { signal }), `p|${page}`, { isEmpty: () => false });
	const labelOf = useLookupLabels(res.data, FK);
	const rows = res.data || [];

	return (
		<>
			<PageHeader
				title="Presentations"
				description="Full-screen executive decks built from live data for a saved period and filters"
				actions={
					<Button variant="primary" icon="plus" to={ROUTES.presentationNew}>
						New presentation
					</Button>
				}
			/>
			<StateView res={res} loadingLines={4}>
				{rows.length === 0 ? (
					<div className="card">
						<div className="state">
							<div className="state__title">No presentations yet</div>
							<p>Pick the sections, reporting period and filters, then save the deck to present it again any time.</p>
							<Button variant="primary" icon="plus" to={ROUTES.presentationNew}>
								Create a presentation
							</Button>
						</div>
					</div>
				) : (
					<>
						<DataTable
							caption="Saved presentations"
							columns={[
								{ key: 'title', label: 'Title' },
								{ key: 'team_id', label: 'Team', render: (r) => (r.team_id ? labelOf('team_id', r.team_id) : 'All teams') },
								{ key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
								{ key: 'last_presented_at', label: 'Last presented', render: (r) => (r.last_presented_at ? formatDateTime(r.last_presented_at) : EMPTY) },
								{ key: 'MODIFIEDTIME', label: 'Updated', render: (r) => formatDateTime(r.MODIFIEDTIME) },
							]}
							rows={rows}
							rowActions={(row) => (
								<>
									<Button size="sm" variant="primary" icon="play" to={ROUTES.present(row.ROWID)}>
										Present
									</Button>
									<Button size="sm" icon="edit" to={ROUTES.presentationEdit(row.ROWID)}>
										Edit
									</Button>
									<Button size="sm" variant="ghost" icon="trash" aria-label={`Delete ${row.title}`} onClick={() => setTarget(row)}>
										Delete
									</Button>
								</>
							)}
						/>
						<Pagination meta={res.meta} onPage={setPage} />
					</>
				)}
			</StateView>
			{target ? (
				<ConfirmDialog
					title={`Delete “${target.title}”?`}
					message="The saved presentation is removed. Your data is not affected."
					onCancel={() => setTarget(null)}
					onConfirm={async () => {
						await presentationsService.remove(target.ROWID);
						setTarget(null);
						notify('Presentation deleted');
						res.reload();
					}}
				/>
			) : null}
		</>
	);
}
