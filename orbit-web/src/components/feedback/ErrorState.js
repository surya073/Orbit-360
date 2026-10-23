import React from 'react';
import Button from '../common/Button';
import Icon from '../common/Icon';

function describe(error) {
	if (!error) return { title: 'Something went wrong', message: 'Please try again.' };
	if (error.status === 401) return { title: 'Your session has expired', message: 'Sign in again to continue.' };
	if (error.status === 403) return { title: 'You do not have access to this', message: error.message };
	if (error.status === 0) return { title: 'Cannot reach the server', message: error.message };
	if (error.status === 404) return { title: 'This data is not available yet', message: 'The service for this view is not reachable or not set up.' };
	return { title: 'This could not be loaded', message: error.message };
}

/**
 * A data-model or permission problem on the server comes with a detail that names the table or column at fault (never
 * a row value), so it is shown: that is what lets an administrator fix the Data Store.
 */
const setupDetail = (error) => (error && /^DATASTORE_/.test(String(error.code || '')) && Array.isArray(error.details) && error.details[0] && error.details[0].message ? String(error.details[0].message) : null);

/** Consistent unavailable/unauthorized/error state with retry. Shows a short reference for support. */
export default function ErrorState({ error, onRetry, compact }) {
	const { title, message } = describe(error);
	return (
		<div className="state state--error" role="alert" style={compact ? { padding: 'var(--space-4)' } : undefined}>
			<span className="state__icon">
				<Icon name="alert" size={18} />
			</span>
			<div className="state__title">{title}</div>
			<p>{message}</p>
			{setupDetail(error) ? <p className="small">{setupDetail(error)}</p> : null}
			{error && error.requestId ? <p className="small">Reference {String(error.requestId).slice(0, 8)}</p> : null}
			{onRetry && error && error.status !== 403 ? (
				<Button size="sm" icon="refresh" onClick={onRetry}>
					Try again
				</Button>
			) : null}
		</div>
	);
}
