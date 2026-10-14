import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { ROUTES } from '../../config/routes';
import Icon from '../common/Icon';
import Popover from '../common/Popover';

const initials = (name = '') =>
	name
		.split(/[\s@.]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0].toUpperCase())
		.join('') || '?';

export default function UserMenu() {
	const { user, signOut } = useAuth();
	return (
		<Popover
			label="Account"
			trigger={({ toggle, props }) => (
				<button type="button" className="user-trigger" onClick={toggle} aria-label={`Account menu for ${user.displayName}`} {...props}>
					<span className="avatar" aria-hidden="true">
						{initials(user.displayName)}
					</span>
					<Icon name="chevronDown" size={13} />
				</button>
			)}
		>
			{({ close }) => (
				<div style={{ minWidth: 230 }}>
					<div className="popover__head">
						<strong>{user.displayName}</strong>
						{user.email}
						<br />
						{user.role === 'admin' ? 'Administrator · all teams' : 'Manager · assigned team'}
					</div>
					<Link className="menu-item" to={`${ROUTES.settings}?tab=profile`} onClick={close}>
						<Icon name="user" size={15} />
						Profile
					</Link>
					<Link className="menu-item" to={`${ROUTES.settings}?tab=appearance`} onClick={close}>
						<Icon name="palette" size={15} />
						Appearance
					</Link>
					<Link className="menu-item" to={ROUTES.settings} onClick={close}>
						<Icon name="settings" size={15} />
						Settings
					</Link>
					<div className="menu-sep" />
					<button type="button" className="menu-item" onClick={signOut}>
						<Icon name="logout" size={15} />
						Sign out
					</button>
				</div>
			)}
		</Popover>
	);
}
