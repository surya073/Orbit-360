import React, { useId } from 'react';

/** Panel with an optional header. `title` is also the section's accessible name. */
export default function Card({ title, subtitle, actions, children, className = '', bodyClassName = '' }) {
	const id = useId();
	return (
		<section className={`card ${className}`.trim()} aria-labelledby={title ? id : undefined}>
			{title || actions ? (
				<header className="card__head">
					<div>
						{title ? (
							<h2 id={id} className="card__title">
								{title}
							</h2>
						) : null}
						{subtitle ? <p className="card__sub">{subtitle}</p> : null}
					</div>
					{actions ? <div className="card__actions">{actions}</div> : null}
				</header>
			) : null}
			<div className={`card__body ${bodyClassName}`.trim()}>{children}</div>
		</section>
	);
}
