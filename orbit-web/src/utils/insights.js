import { daysSince } from './periods';
import { formatDate } from './dates';
import { formatMinutes, formatPercent } from './format';

const usable = (m) => m && (m.completeness === 'complete' || m.completeness === 'partial');

/**
 * Deterministic findings derived ONLY from backend-computed metrics that were actually returned.
 * Nothing is inferred from missing data, and no thresholds are invented: statements are facts
 * ("N are past due") rather than judgements ("team is underperforming").
 *
 * inputs: { overview, projects, product, freshness, today } - any may be undefined.
 * returns [{ id, tone: 'info'|'warning'|'success', title, detail? }]
 */
export function computeInsights({ overview, projects, product, freshness, today } = {}) {
	const out = [];
	const push = (id, tone, title, detail) => out.push({ id, tone, title, ...(detail ? { detail } : {}) });

	if (overview) {
		const t = overview.time;
		if (usable(t) && t.totalMinutes > 0) {
			push('billable-share', 'info', `${formatPercent(t.billablePercent)} of approved time is billable`, `${formatMinutes(t.billableMinutes)} billable and ${formatMinutes(t.nonBillableMinutes)} non-billable across ${t.approvedEntries} approved entries.`);
		}
		if (t && t.excluded && t.excluded.pending > 0) {
			push('pending-approval', 'warning', `${t.excluded.pending} time ${t.excluded.pending === 1 ? 'entry is' : 'entries are'} awaiting approval`, 'Pending entries are excluded from every time total until approved.');
		}
		const a = overview.attendance;
		if (usable(a) && a.lateRatePercent !== null) {
			push('late-rate', 'info', `${formatPercent(a.lateRatePercent)} of recorded check-ins were late`, `${a.lateCount} late and ${a.onTimeCount} on time.`);
		}
		if (a && a.unknownCount > 0) push('late-unknown', 'warning', `${a.unknownCount} attendance ${a.unknownCount === 1 ? 'record has' : 'records have'} no late status`, 'They are left out of the late rate rather than counted as on time.');
		const l = overview.leave;
		if (l && l.missingUnitsCount > 0) push('leave-units', 'warning', `${l.missingUnitsCount} leave ${l.missingUnitsCount === 1 ? 'record has' : 'records have'} no units recorded`, 'Approved leave totals may be understated.');
	}

	if (projects && usable(projects.workload)) {
		const over = projects.workload.projects.filter((p) => p.burnPercent !== null && p.burnPercent > 100);
		over.slice(0, 3).forEach((p) => push(`over-${p.projectId}`, 'warning', `${p.name || `Project #${p.projectId}`} has used ${formatPercent(p.burnPercent)} of its estimated hours`, 'Lifetime approved hours compared with the project estimate.'));
		const noEstimate = projects.workload.projects.filter((p) => p.estimatedHours === null).length;
		if (noEstimate > 0) push('no-estimate', 'info', `${noEstimate} of the busiest projects ${noEstimate === 1 ? 'has' : 'have'} no estimated hours`, 'Burn against estimate cannot be shown for them.');
	}

	if (product && usable(product.product) && product.product.overdue > 0) {
		push('overdue', 'warning', `${product.product.overdue} open product ${product.product.overdue === 1 ? 'item is' : 'items are'} past due`, 'Open means no completed date; due date is earlier than today.');
	}

	if (freshness) {
		const latest = freshness.timeEntries && freshness.timeEntries.latestDate;
		if (!latest) push('no-time', 'info', 'No time entries have been recorded yet', 'Import or add time entries to see billable hours.');
		else {
			const days = daysSince(latest, today);
			if (days > 7) push('stale-time', 'warning', `The latest time entry is from ${formatDate(latest)}`, `${days} days ago. Recent work may not be imported yet.`);
		}
	}

	if (out.length === 0) push('none', 'info', 'No notable findings for this selection');
	return out.slice(0, 8);
}
