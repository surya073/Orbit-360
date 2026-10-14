import React from 'react';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/dates';
import { EMPTY, formatBool, formatMinutes, formatNumber, formatPercent } from '../../utils/format';

/** Column `type` -> display. Missing values are always a dash, never 0 or blank. */
export function renderCell(col, row, labelOf) {
	const v = row[col.key];
	switch (col.type) {
		case 'date':
			return formatDate(v);
		case 'minutes':
			return formatMinutes(v);
		case 'number':
			return formatNumber(v, 2);
		case 'percent':
			return formatPercent(v);
		case 'bool':
			return formatBool(v);
		case 'status':
			return <StatusBadge status={v} />;
		case 'fk':
			return labelOf(col.key, v) || EMPTY;
		default:
			return v === null || v === undefined || v === '' ? EMPTY : String(v);
	}
}
