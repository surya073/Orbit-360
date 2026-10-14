import React from 'react';
import Icon from '../../../components/common/Icon';
import { formatDate, formatDateTime } from '../../../utils/dates';
import { daysSince } from '../../../utils/periods';

/** How current the underlying data is: newest time entry, newest attendance day, last import. */
export default function FreshnessBar({ res, period }) {
	const d = res.data;
	const age = (date) => {
		if (!date) return 'none yet';
		const n = daysSince(date);
		return `${formatDate(date)}${n > 0 ? ` (${n}d ago)` : ' (today)'}`;
	};
	return (
		<div className="freshness" aria-label="Data freshness">
			{period ? (
				<span>
					<Icon name="calendar" size={12} />
					{formatDate(period.from)} – {formatDate(period.to)} · IST
				</span>
			) : null}
			{res.status === 'error' ? (
				<span>Freshness unavailable</span>
			) : d ? (
				<>
					<span>
						<Icon name="clock" size={12} />
						Latest time entry: {age(d.timeEntries.latestDate)}
					</span>
					<span>Latest attendance: {age(d.attendance.latestDate)}</span>
					<span>Last import: {d.imports.lastCompletedAt ? formatDateTime(d.imports.lastCompletedAt) : 'none yet'}</span>
				</>
			) : (
				<span>Checking data freshness…</span>
			)}
		</div>
	);
}
