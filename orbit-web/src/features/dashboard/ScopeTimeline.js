import React from 'react';
import Icon from '../../components/common/Icon';

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const pad = (n) => String(n).padStart(2, '0');
const day = (s) => Date.parse(`${s}T00:00:00Z`);
export const fmtDay = (s) => new Date(day(s)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const monthRange = (year, m) => ({ from: `${year}-${pad(m + 1)}-01`, to: `${year}-${pad(m + 1)}-${pad(new Date(Date.UTC(year, m + 1, 0)).getUTCDate())}` });

/**
 * A year as twelve month buttons with the selected window lit up. Controlled: the owner
 * keeps the year (arrows call onYear) and decides what a click on a month means (onPick(month index)).
 * `viewing` outlines the month whose calendar is open (custom range).
 */
export default function ScopeTimeline({ from, to, year, onYear, onPick, viewing = null, label = 'Pick a month' }) {
	const valid = Boolean(from && to && to >= from);
	const start = day(`${year}-01-01`);
	const total = day(`${year + 1}-01-01`) - start;
	const pos = (s) => Math.min(1, Math.max(0, (day(s) - start) / total));
	const inYear = valid && to >= `${year}-01-01` && from <= `${year}-12-31`;
	const left = valid ? pos(from) : 0;
	const width = valid ? Math.max(pos(to) + 86400000 / total - left, 0.006) : 0;
	const exact = (m) => {
		const r = monthRange(year, m);
		return valid && r.from === from && r.to === to;
	};
	return (
		<div className="otime" role="group" aria-label={label}>
			<div className="otime__year">
				<button type="button" className="otime__step" aria-label={`Show ${year - 1}`} onClick={() => onYear(year - 1)}>
					<Icon name="chevronLeft" size={14} />
				</button>
				<b>{year}</b>
				<button type="button" className="otime__step" aria-label={`Show ${year + 1}`} onClick={() => onYear(year + 1)}>
					<Icon name="chevronRight" size={14} />
				</button>
			</div>
			<div className="otime__bar">
				{MONTH_NAMES.map((name, m) => (
					<button key={name} type="button" className={`otime__month ${viewing === m ? 'is-viewing' : ''}`.trim()} aria-label={`${name} ${year}`} aria-pressed={exact(m)} onClick={() => onPick(m)}>
						<span className="otime__long">{name.slice(0, 3)}</span>
						<span className="otime__short" aria-hidden="true">
							{name[0]}
						</span>
					</button>
				))}
				{inYear ? <span className="otime__span" aria-hidden="true" style={{ left: `${left * 100}%`, width: `${Math.min(width, 1 - left) * 100}%` }} /> : null}
			</div>
			<p className="otime__text" role="status">
				{valid ? (
					<>
						<b>{from === to ? fmtDay(from) : `${fmtDay(from)} → ${fmtDay(to)}`}</b>
						<span>{Math.round((day(to) - day(from)) / 86400000) + 1} days</span>
					</>
				) : (
					<span>Pick a range</span>
				)}
			</p>
		</div>
	);
}
