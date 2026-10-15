import { useEffect, useMemo, useState } from 'react';
import usePageSize from './usePageSize';

/**
 * Pagination for lists that are already fully loaded (settings, import previews). Returns the rows
 * of the current page plus `meta` in the same shape the server's paginated responses use, so the
 * shared Pagination component renders it unchanged.
 */
export default function useClientPagination(rows, name, fallback) {
	const [pageSize, setPageSize] = usePageSize(name, fallback);
	const [page, setPage] = useState(1);
	const total = rows.length;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	useEffect(() => {
		if (page > totalPages) setPage(totalPages);
	}, [page, totalPages]);
	const current = Math.min(page, totalPages);
	const pageRows = useMemo(() => rows.slice((current - 1) * pageSize, current * pageSize), [rows, current, pageSize]);
	return {
		rows: pageRows,
		meta: { page: current, pageSize, total, totalPages },
		pagination: { meta: { page: current, pageSize, total, totalPages }, onPage: setPage, pageSize, onPageSize: (n) => { setPageSize(n); setPage(1); } },
	};
}
