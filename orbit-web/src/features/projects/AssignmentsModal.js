import React, { useState } from 'react';
import Button from '../../components/common/Button';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import StateView from '../../components/feedback/StateView';
import { useToast } from '../../components/feedback/ToastProvider';
import ResourceForm from '../../components/forms/ResourceForm';
import DataTable from '../../components/tables/DataTable';
import Pagination from '../../components/tables/Pagination';
import useApiResource from '../../hooks/useApiResource';
import useLookupLabels from '../../hooks/useLookup';
import usePageSize from '../../hooks/usePageSize';
import useTemplates from '../../hooks/useTemplates';
import { resourceService } from '../../services/resourceService';
import { renderCell } from '../resources/renderCell';
import { assignmentsConfig } from './config';

/**
 * Employees assigned to one project. An employee-project link is one row (hours live in time
 * entries), so adding people here never changes project totals.
 */
export default function AssignmentsModal({ project, canWrite, onClose }) {
	const { notify } = useToast();
	const templates = useTemplates();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = usePageSize('project_assignments', 10);
	const [sub, setSub] = useState(null); // { type: 'form' } | { type: 'delete', row }
	const res = useApiResource((signal) => resourceService.list('project_assignments', { project_id: project.ROWID, page, pageSize }, { signal }), `asg|${project.ROWID}|${page}|${pageSize}`, { isEmpty: () => false });
	const labelOf = useLookupLabels(res.data, assignmentsConfig.fkColumns);
	const template = templates.byModule.project_assignments;
	const rows = res.data || [];

	return (
		<Modal title={`Assignments · ${project.project_name}`} onClose={onClose} size="lg">
			{canWrite && template ? (
				<div style={{ marginBottom: 12 }}>
					<Button variant="primary" icon="plus" onClick={() => setSub({ type: 'form' })}>
						Assign employee
					</Button>
				</div>
			) : null}
			<StateView res={res} loadingLines={4}>
				{rows.length === 0 ? (
					<p className="muted">No employees are assigned to this project yet.</p>
				) : (
					<>
						<DataTable
							caption="Project assignments"
							columns={assignmentsConfig.columns.map((c) => ({ key: c.key, label: c.label, render: (row) => renderCell(c, row, labelOf) }))}
							rows={rows}
							rowActions={canWrite ? (row) => <Button size="sm" variant="ghost" icon="trash" aria-label="Remove assignment" onClick={() => setSub({ type: 'delete', row })}>Remove</Button> : undefined}
						/>
						<Pagination meta={res.meta} onPage={setPage} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
					</>
				)}
			</StateView>

			{sub && sub.type === 'form' ? (
				<Modal title="Assign employee" onClose={() => setSub(null)}>
					<ResourceForm
						resource="project_assignments"
						template={template}
						defaults={{ project_id: project.ROWID }}
						lockedFields={['project_id']}
						formId="assignment-form"
						onCancel={() => setSub(null)}
						onSaved={() => {
							setSub(null);
							notify('Employee assigned');
							res.reload();
						}}
					/>
				</Modal>
			) : null}
			{sub && sub.type === 'delete' ? (
				<ConfirmDialog
					title="Remove this assignment?"
					confirmLabel="Remove"
					message="The employee is unassigned from the project. Time already logged is kept."
					onCancel={() => setSub(null)}
					onConfirm={async () => {
						await resourceService.remove('project_assignments', sub.row.ROWID);
						setSub(null);
						notify('Assignment removed');
						res.reload();
					}}
				/>
			) : null}
		</Modal>
	);
}
