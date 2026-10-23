import React from 'react';

/** Page title block. `meta` (e.g. freshness) sits under the description; `actions` on the right. */
export default function PageHeader({ title, description, actions, meta }) {
	return (
		<header className="page-header">
			<div className="page-header__text">
				<h1>{title}</h1>
				{description ? <p>{description}</p> : null}
				{meta ? <div className="u-mt-6px">{meta}</div> : null}
			</div>
			{actions ? <div className="page-header__actions">{actions}</div> : null}
		</header>
	);
}
