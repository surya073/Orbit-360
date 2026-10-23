import React from 'react';

/** Skeleton placeholder. `lines` rows, or `height` for a block (charts). */
export default function LoadingState({ lines = 3, height, label = 'Loading' }) {
	return (
		<div role="status" aria-live="polite" aria-label={label}>
			<span className="sr-only">{label}…</span>
			{height ? (
				<div className="skeleton" style={{ height }} />
			) : (
				<div className="loading-lines">
					{Array.from({ length: lines }, (_, i) => (
						<div key={i} className="skeleton" style={{ height: 14, width: `${100 - i * 12}%` }} />
					))}
				</div>
			)}
		</div>
	);
}
