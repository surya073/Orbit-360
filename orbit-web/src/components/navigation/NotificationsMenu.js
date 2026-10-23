import React from 'react';
import { IconButton } from '../common/Button';
import Popover from '../common/Popover';
import EmptyState from '../feedback/EmptyState';

/**
 * There is no notifications backend yet, so this says so plainly instead of showing a fake badge
 * or an empty-looking "all caught up" list.
 */
export default function NotificationsMenu() {
	return (
		<Popover
			label="Notifications"
			trigger={({ toggle, props }) => <IconButton icon="bell" label="Notifications" onClick={toggle} {...props} />}
		>
			<div className="notif-menu">
				<div className="popover__head">
					<strong>Notifications</strong>
				</div>
				<EmptyState icon="bell" title="Not available yet" message="Notifications will appear here once the notification service is connected. Nothing is being collected in the meantime." />
			</div>
		</Popover>
	);
}
