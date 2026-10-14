import React from 'react';
import Icon from '../common/Icon';

export default function EmptyState({ icon = 'info', title = 'Nothing here yet', message, action }) {
	return (
		<div className="state">
			<span className="state__icon">
				<Icon name={icon} size={18} />
			</span>
			<div className="state__title">{title}</div>
			{message ? <p>{message}</p> : null}
			{action}
		</div>
	);
}
