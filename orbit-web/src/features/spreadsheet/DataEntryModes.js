import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/common/Icon';
import { ROUTES } from '../../config/routes';
import { sheetModule } from './spreadsheetModules';

/**
 * The three ways to enter data: Add form (the existing per-record dialog on each module page),
 * Sheet import (CSV import) and Spreadsheet editor. `current` marks where the user is.
 */
export default function DataEntryModes({ current, resource }) {
	const mod = sheetModule(resource);
	const options = [
		{ id: 'form', label: 'Add form', icon: 'edit', hint: 'One record at a time', to: mod ? `${mod.route}?new=1` : ROUTES.employees },
		{ id: 'import', label: 'Sheet import', icon: 'upload', hint: 'Upload a CSV file', to: ROUTES.imports },
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
