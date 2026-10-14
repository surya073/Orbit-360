import React from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';

/**
 * Button / link-button. Every instance must do something: pass onClick, type="submit", or `to`.
 * variant: primary | secondary | ghost | danger. `loading` disables the control and shows progress.
 */
export default function Button({ variant = 'secondary', size, icon, loading, to, children, className = '', type = 'button', ...rest }) {
	const cls = `btn ${variant !== 'secondary' ? `btn--${variant}` : ''} ${size === 'sm' ? 'btn--sm' : ''} ${className}`.replace(/\s+/g, ' ').trim();
	const content = (
		<>
			{loading ? <span className="spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={size === 'sm' ? 13 : 15} /> : null}
			{children}
		</>
	);
	if (to) {
		return (
			<Link to={to} className={cls} {...rest}>
				{content}
			</Link>
		);
	}
	return (
		<button type={type} className={cls} disabled={loading || rest.disabled} aria-busy={loading || undefined} {...rest}>
			{content}
		</button>
	);
}

export function IconButton({ icon, label, badge, className = '', ...rest }) {
	return (
		<button type="button" className={`icon-btn ${className}`.trim()} aria-label={label} title={label} {...rest}>
			<Icon name={icon} size={17} />
			{badge ? <span className="sr-only">{badge}</span> : null}
		</button>
	);
}
