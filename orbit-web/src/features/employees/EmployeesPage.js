import React from 'react';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import { ROUTES } from '../../config/routes';
import ResourcePage from '../resources/ResourcePage';
import { employeesConfig } from './config';

/** Directory plus a prominent entry to the Reporting Structure builder (drag-and-drop org tree). */
const reportingPromo = (
	<section className="rs-promo" aria-label="Reporting structure">
		<span className="rs-promo__icon" aria-hidden="true">
			<Icon name="team" size={22} />
		</span>
		<div className="rs-promo__text">
			<h2>Reporting structure</h2>
			<p>Drag employees into a visual org tree, set who reports to whom and save it. The saved tree appears as an animated slide in your presentations.</p>
		</div>
		<Button variant="primary" to={ROUTES.reporting}>
			Open reporting structure
		</Button>
	</section>
);

export default function EmployeesPage() {
	return <ResourcePage config={employeesConfig} topSlot={reportingPromo} />;
}
