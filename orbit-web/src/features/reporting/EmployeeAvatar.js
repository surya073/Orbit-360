import React from 'react';
import { hashIndex, initialsOf } from './treeModel';

const TONES = 6;

/**
 * Circular avatar. Uses the employee's real photo when the record has one (`imageUrl`); the
 * employee sheet has no photo column today, so this is normally a consistent initials avatar.
 * The tone ring comes from the theme's chart colours (var(--chart-N)), keyed by employee id.
 */
export default function EmployeeAvatar({ employee, size = 56, className = '' }) {
	const tone = hashIndex(employee.id, TONES) + 1;
	const style = { width: size, height: size, fontSize: Math.round(size * 0.36), '--rs-tone': `var(--chart-${tone})` };
	return (
		<span className={`rs-avatar ${className}`.trim()} style={style} aria-hidden="true">
			{employee.imageUrl ? <img src={employee.imageUrl} alt="" /> : initialsOf(employee.name)}
		</span>
	);
}
