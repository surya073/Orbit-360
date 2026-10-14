import React from 'react';

/** Wrapping row of filter controls. Use role="search" semantics via `label`. */
export default function FilterBar({ label, children, onSubmit }) {
	const Tag = onSubmit ? 'form' : 'div';
	return (
		<Tag className="filter-bar" role="search" aria-label={label} onSubmit={onSubmit}>
			{children}
		</Tag>
	);
}
