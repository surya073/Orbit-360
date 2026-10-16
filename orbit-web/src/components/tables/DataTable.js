import React from 'react';

/**
 * Presentational table. Horizontal scroll on narrow screens (focusable so keyboard users can
 * scroll it). On phones each row becomes a stacked card (the CSS reads the cells' data-label). columns: [{ key, label, render?(row), align? }]. Empty/error states are the
 * caller's job (StateView) so this component only ever renders rows.
 */
export default function DataTable({ caption, columns, rows, rowActions, rowKey = 'ROWID' }) {
	return (
		<div className="table-wrap" tabIndex={0} role="region" aria-label={caption}>
			<table className="table">
				<caption className="sr-only">{caption}</caption>
				<thead>
					<tr>
						{columns.map((c) => (
							<th key={c.key} scope="col" style={c.align ? { textAlign: c.align } : undefined}>
								{c.label}
							</th>
						))}
						{rowActions ? (
							<th scope="col">
								<span className="sr-only">Actions</span>
							</th>
						) : null}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row[rowKey]}>
							{columns.map((c) => (
								<td key={c.key} data-label={c.label} data-empty={!c.render && (row[c.key] === null || row[c.key] === undefined || row[c.key] === '') ? 'true' : undefined} style={c.align ? { textAlign: c.align } : undefined} title={typeof row[c.key] === 'string' ? row[c.key] : undefined}>
									{c.render ? c.render(row) : row[c.key] ?? <span className="muted">—</span>}
								</td>
							))}
							{rowActions ? (
								<td className="actions">
									<div className="row-actions">{rowActions(row)}</div>
								</td>
							) : null}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
