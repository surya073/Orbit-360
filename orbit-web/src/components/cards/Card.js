import React, { useId } from 'react';
import Icon from '../common/Icon';

/** Panel with an optional header. `title` is also the section's accessible name. `icon` adds a tinted glyph chip. */
export default function Card({ title, subtitle, actions, children, className = '', bodyClassName = '', icon, accent }) {
	const id = useId();
	return (
		<section className={`card ${className}`.trim()} aria-labelledby={title ? id : undefined} style={accent ? { '--card-accent': accent } : undefined}>
			{title || actions ? (
				<header className="card__head">
					{icon ? (
						<span className="card__icon" aria-hidden="true">
							<Icon name={icon} size={16} />
						</span>
					) : null}
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
