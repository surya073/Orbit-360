import React from 'react';
import { Link } from 'react-router-dom';
// Replace src/assets/images/logo.svg with the real asset; nothing else needs to change.
import logo from '../../assets/images/logo.svg';
import { ROUTES } from '../../config/routes';

export default function Logo({ link = true }) {
	const inner = (
		<>
			<img src={logo} alt="" width="24" height="24" />
			<span>Company 360</span>
		</>
	);
	return link ? (
		<Link to={ROUTES.dashboard} className="brand" aria-label="Company 360 home">
			{inner}
		</Link>
	) : (
		<span className="brand">{inner}</span>
	);
}
