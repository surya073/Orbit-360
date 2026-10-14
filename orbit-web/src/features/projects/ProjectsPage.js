import React, { useState } from 'react';
import Button from '../../components/common/Button';
import ResourcePage from '../resources/ResourcePage';
import AssignmentsModal from './AssignmentsModal';
import { projectsConfig } from './config';

export default function ProjectsPage() {
	const [open, setOpen] = useState(null);
	return (
		<>
			<ResourcePage
				config={projectsConfig}
				rowExtras={(row) => (
					<Button size="sm" icon="users" onClick={() => setOpen(row)}>
						Assignments
					</Button>
				)}
			/>
			{open ? <AssignmentsModal project={open} canWrite onClose={() => setOpen(null)} /> : null}
		</>
	);
}
