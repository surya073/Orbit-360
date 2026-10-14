import React from 'react';
import Field from '../forms/Field';
import LookupSelect from '../forms/LookupSelect';

/** Optional project narrowing (server-side searchable). Empty = all projects in scope. */
export default function ProjectFilter({ value, onChange }) {
	return (
		<Field label="Project">
			{(p) => <LookupSelect column="project_id" value={value || ''} onChange={onChange} controlProps={p} placeholder="All projects" compact />}
		</Field>
	);
}
