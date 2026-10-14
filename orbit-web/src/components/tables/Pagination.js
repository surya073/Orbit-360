import React from 'react';
import Button from '../common/Button';

export default function Pagination({ meta, onPage }) {
	if (!meta) return null;
	const { page, totalPages, total, pageSize } = meta;
	const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
	const to = Math.min(page * pageSize, total);
	return (
		<nav className="pager" aria-label="Pagination">
			<Button size="sm" icon="chevronLeft" disabled={page <= 1} onClick={() => onPage(page - 1)}>
				Previous
			</Button>
			<span aria-live="polite">
				{from}–{to} of {total} · page {page} of {Math.max(totalPages, 1)}
			</span>
			<Button size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
				Next
			</Button>
		</nav>
	);
}
