import React from 'react';
import Button from '../../components/common/Button';
import SortableList from '../../components/common/SortableList';
import { Switch } from '../../components/forms/Choice';
import { DASHBOARD_WIDGETS } from '../../config/dashboardLayout';

const BY_ID = Object.fromEntries(DASHBOARD_WIDGETS.map((w) => [w.id, w]));

/** Reorder and show/hide dashboard widgets. Used in the dashboard "Customize" dialog and in Settings. */
export default function DashboardLayoutEditor({ layout }) {
	const items = layout.order.map((id) => ({ id, label: BY_ID[id].label, description: BY_ID[id].description }));
	return (
		<div className="stack">
			<SortableList
				label="Dashboard widgets"
				items={items}
				onReorder={layout.setOrder}
				renderItem={(w, { handle, isFirst, isLast, moveUp, moveDown }) => (
					<div className={`layout-row ${layout.hidden.includes(w.id) ? 'is-hidden' : ''}`.trim()}>
						{handle}
						<div className="layout-row__text">
							<strong>{w.label}</strong>
							<span className="small muted">{w.description}</span>
						</div>
						<div className="layout-row__actions">
							<Button size="sm" variant="ghost" aria-label={`Move ${w.label} up`} disabled={isFirst} onClick={moveUp}>
								↑
							</Button>
							<Button size="sm" variant="ghost" aria-label={`Move ${w.label} down`} disabled={isLast} onClick={moveDown}>
								↓
							</Button>
							<Switch label="Show" aria-label={`Show ${w.label}`} checked={!layout.hidden.includes(w.id)} onChange={(e) => layout.setVisible(w.id, e.target.checked)} />
						</div>
					</div>
				)}
			/>
			<div>
				<Button size="sm" icon="refresh" onClick={layout.reset} disabled={layout.isDefault}>
					Reset to default layout
				</Button>
			</div>
		</div>
	);
}
