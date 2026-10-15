import React from 'react';
import Card from '../../../components/cards/Card';
import BarList from '../../../components/charts/BarList';
import DonutChart from '../../../components/charts/DonutChart';
import { colorAt } from '../../../components/charts/scale';
import StackedBar from '../../../components/charts/StackedBar';
import EmptyState from '../../../components/feedback/EmptyState';
import StateView from '../../../components/feedback/StateView';
import CompletenessBadge from '../../../components/cards/CompletenessBadge';
import { formatNumber, humanize, metricNote } from '../../../utils/format';

const Block = ({ title, metric, children }) => (
	<div className="block">
		<h3 className="block__title">
			{title}
			<CompletenessBadge metric={metric} />
		</h3>
		{children}
	</div>
);

const Unavailable = ({ metric }) => <p className="small muted">{metricNote(metric) || 'No data for this selection.'}</p>;

/**
 * People, attendance and leave in one card. Headcount by employment status, the late / on-time /
 * unknown split of attendance records, and leave records by status with approved days and hours.
 * All values are the backend's headcount, attendance and leave metrics; unknown late status is
 * shown on its own and never counted as on time.
 */
export default function PeopleLeaveCard({ res }) {
	const o = res.data;
	const head = o && o.headcount;
	const att = o && o.attendance;
	const leave = o && o.leave;
	const allNa = o && [head, att, leave].every((m) => m && m.completeness === 'not_applicable');
	const usable = (m) => m && (m.completeness === 'complete' || m.completeness === 'partial');

	return (
		<Card icon="users" accent="var(--chart-1)" title="People, attendance and leave" subtitle="Headcount, check-in punctuality and leave records for the period">
			<StateView res={res} loadingHeight={200}>
				{allNa ? (
					<EmptyState icon="info" title="Not available for this selection" message={head.reason} />
				) : o ? (
					<div className="triple">
						<Block title="Employees by status" metric={head}>
							{usable(head) && Object.keys(head.byStatus).length ? <DonutChart ariaLabel="Employees by status" centerLabel="employees" segments={Object.entries(head.byStatus).map(([k, v], i) => ({ label: humanize(k), value: v, color: colorAt(i) }))} /> : <Unavailable metric={head} />}
						</Block>
						<Block title="Check-in punctuality" metric={att}>
							{usable(att) ? (
								<>
									<StackedBar
										ariaLabel="Attendance records by late status"
										segments={[
											{ label: 'On time', value: att.onTimeCount, color: 'var(--chart-3)' },
											{ label: 'Late', value: att.lateCount, color: 'var(--chart-5)' },
											{ label: 'Unknown', value: att.unknownCount, color: 'var(--chart-6)' },
										]}
									/>
									<p className="small muted">{formatNumber(att.records)} records. Unknown late status is left out of the late rate, not counted as on time.</p>
								</>
							) : (
								<Unavailable metric={att} />
							)}
						</Block>
						<Block title="Leave" metric={leave}>
							{usable(leave) ? (
								<>
									<dl className="stats stats--tight">
										<div>
											<dt>Approved days</dt>
											<dd className="num">{formatNumber(leave.approvedDays, 1)}</dd>
										</div>
										<div>
											<dt>Approved hours</dt>
											<dd className="num">{formatNumber(leave.approvedHours, 1)}</dd>
										</div>
									</dl>
									<BarList ariaLabel="Leave records by status" items={Object.entries(leave.byStatus).map(([k, v], i) => ({ id: k, label: humanize(k), value: v, color: colorAt(i + 2) }))} />
								</>
							) : (
								<Unavailable metric={leave} />
							)}
						</Block>
					</div>
				) : null}
			</StateView>
		</Card>
	);
}
