import React from 'react';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import LoadingState from './LoadingState';

/**
 * Renders the explicit loading / error / empty states of a useApiResource result, then
 * `children` on success. While reloading with data already present, children stay visible.
 */
export default function StateView({ res, children, emptyTitle, emptyMessage, emptyIcon, emptyAction, loadingHeight, loadingLines, compact }) {
	if (res.status === 'idle') return null;
	if (res.status === 'loading' && !res.data) return <LoadingState height={loadingHeight} lines={loadingLines} />;
	if (res.status === 'error') return <ErrorState error={res.error} onRetry={res.reload} compact={compact} />;
	if (res.status === 'empty') return <EmptyState icon={emptyIcon} title={emptyTitle} message={emptyMessage} action={emptyAction} />;
	return children;
}
