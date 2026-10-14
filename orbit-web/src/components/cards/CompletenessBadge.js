import React from 'react';
import { COMPLETENESS_LABEL, metricNote } from '../../utils/format';
import StatusBadge from '../common/StatusBadge';

/**
 * Shows how complete a backend metric is. Renders nothing for `complete` unless `always`.
 * The explanation is visible text (not only a tooltip) so it works on touch and for screen readers.
 */
export default function CompletenessBadge({ metric, always = false, showNote = false }) {
	if (!metric || !metric.completeness) return null;
	if (metric.completeness === 'complete' && !always) return null;
	const note = metricNote(metric);
	return (
		<span title={note || undefined}>
			<StatusBadge status={metric.completeness} label={COMPLETENESS_LABEL[metric.completeness]} />
			{showNote && note ? <span className="small muted"> {note}</span> : null}
		</span>
	);
}
