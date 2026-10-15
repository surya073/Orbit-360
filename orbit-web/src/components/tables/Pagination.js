import React from 'react';
import { PAGE_SIZES } from '../../config/constants';
import Button from '../common/Button';

/**
 * Pager with an optional rows-per-page choice. Pass `pageSize` + `onPageSize` to show the choice
 * (the owner must reset to page 1 when it changes). Without them it is the plain pager.
 */
export default function Pagination({ meta, onPage, pageSize, onPageSize, sizes = PAGE_SIZES }) {
	if (!meta) return null;
	const { page, totalPages, total } = meta;
	const size = pageSize || meta.pageSize;
	const per = meta.pageSize || size; // the range reflects what the server actually returned
	const from = total === 0 ? 0 : (page - 1) * per + 1;
	const to = Math.min(page * per, total);
	return (
		<nav className="pager" aria-label="Pagination">
			{onPageSize ? (
				<label className="pager__size">
					<span>Rows per page</span>
					<select value={size} onChange={(e) => onPageSize(Number(e.target.value))} aria-label="Rows per page">
						{[...new Set([...sizes, size])].sort((a, b) => a - b).map((n) => (
							<option key={n} value={n}>
								{n}
							</option>
						))}
					</select>
				</label>
			) : null}
			<span className="pager__range" aria-live="polite">
				{from}–{to} of {total} · page {page} of {Math.max(totalPages, 1)}
			</span>
			<span className="pager__nav">
				<Button size="sm" disabled={page <= 1} onClick={() => onPage(1)} aria-label="First page" title="First page">
					First
				</Button>
				<Button size="sm" icon="chevronLeft" disabled={page <= 1} onClick={() => onPage(page - 1)}>
					Previous
				</Button>
				<Button size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
					Next
				</Button>
				<Button size="sm" disabled={page >= totalPages} onClick={() => onPage(totalPages)} aria-label="Last page" title="Last page">
					Last
				</Button>
			</span>
		</nav>
	);
}
