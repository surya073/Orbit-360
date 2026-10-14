import React from 'react';
import { humanize } from '../../utils/format';
import { toneFor } from '../../utils/status';

/** Status as text + dot + tone: meaning never depends on color alone. */
export default function StatusBadge({ status, tone, label }) {
	if (status === null || status === undefined || status === '') return <span className="muted">—</span>;
	return <span className={`badge badge--${tone || toneFor(status)}`}>{label || humanize(status)}</span>;
}
