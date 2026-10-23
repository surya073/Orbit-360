import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/common/Icon';
import { ROUTES } from '../../config/routes';

/**
 * The two ways to load data in bulk: Sheet import (CSV) and the Spreadsheet editor. (Adding one record at a
 * time is the Add button on each module page.) `current` marks where the user is.
 */
export default function DataEntryModes({ current, resource }) {
	const options = [
		{ id: 'import', label: 'Sheet import', icon: 'upload', hint: 'Upload a CSV file', to: `${ROUTES.imports}${resource ? `?module=${resource}` : ''}` },
		{ id: 'sheet', label: 'Spreadsheet editor', icon: 'dashboard', hint: 'Edit many records in a grid', to: `${ROUTES.spreadsheet}${resource ? `?module=${resource}` : ''}` },
	];
	return (
		<nav className="entry-modes" aria-label="Data entry options">
			{options.map((o) => (
				<Link key={o.id} to={o.to} className={`entry-mode ${current === o.id ? 'is-current' : ''}`.trim()} aria-current={current === o.id ? 'page' : undefined}>
					<Icon name={o.icon} size={16} />
					<span>
						<b>{o.label}</b>
						<small>{o.hint}</small>
					</span>
				</Link>
			))}
		</nav>
	);
}
