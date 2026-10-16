import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { businessToday } from '../../utils/dates';
import ScopeTimeline, { MONTH_NAMES, fmtDay, pad } from './ScopeTimeline';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function MonthCalendar({ year, month, start, end, min, step, onPick }) {
	const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7; // Monday first
	const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const today = businessToday();
	const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
	return (
		<div className="ocal" role="group" aria-label={`${MONTH_NAMES[month]} ${year}: choose the ${step === 'start' ? 'first' : 'last'} day`}>
			<p className="ocal__title">
				{MONTH_NAMES[month]} {year}
				<span>{step === 'start' ? 'Choose the first day' : 'Choose the last day'}</span>
			</p>
			<div className="ocal__grid">
				{WEEKDAYS.map((w) => (
					<span key={w} className="ocal__dow" aria-hidden="true">
						{w}
					</span>
				))}
				{cells.map((d, i) => {
					if (d === null) return <span key={`b${i}`} />;
					const iso = `${year}-${pad(month + 1)}-${pad(d)}`;
					const disabled = step === 'end' && min && iso < min;
					const inside = start && end && iso >= start && iso <= end;
					const edge = iso === start || iso === end;
					return (
						<button key={iso} type="button" className={`ocal__day ${inside ? 'is-in' : ''} ${edge ? 'is-edge' : ''} ${iso === today ? 'is-today' : ''}`.replace(/\s+/g, ' ').trim()} disabled={disabled} aria-pressed={edge} aria-label={fmtDay(iso)} onClick={() => onPick(iso)}>
							{d}
						</button>
					);
				})}
			</div>
		</div>
	);
}

/**
 * Custom range, built step by step: pick the start month, a calendar for it opens, pick the day; then the
 * end month (any year, via the arrows) and its day. The range is applied the moment the last day is chosen
 * and can be redone from either step at any time.
 */
export default function CustomRange({ from, to, onCommit, chipsHost, open = true, onOpenChange = () => {} }) {
	const [start, setStart] = useState(from || null);
	const [end, setEnd] = useState(to || null);
	const [step, setStep] = useState('start') // a fresh visit starts a new range; the End chip is one click away;
	const [year, setYear] = useState(Number((to || from || businessToday()).slice(0, 4)));
	const [view, setView] = useState(null); // month index whose calendar is open

	const pickDay = (iso) => {
		if (step === 'start') {
			const keepEnd = end && end >= iso;
			setStart(iso);
			if (!keepEnd) setEnd(null);
			setStep('end');
			setView(null);
			if (keepEnd) onCommit({ from: iso, to: end });
		} else {
			setEnd(iso);
			setView(null);
			onCommit({ from: start, to: iso });
			onOpenChange(false); // the range is complete: let the popover go
		}
	};
	const goStep = (s) => {
		onOpenChange(true);
		setStep(s);
		setView(null);
		const anchor = s === 'start' ? start : end || start;
		if (anchor) setYear(Number(anchor.slice(0, 4)));
	};

	// the Start / End chips live in the filter bar's first row (chipsHost); without a host they sit above the strip
	const chips = (
		<div className="ocustom__steps" role="group" aria-label="Custom range">
			<button type="button" className="ocustom__chip" aria-pressed={step === 'start'} onClick={() => goStep('start')}>
				<small>Start</small>
				<b>{start ? fmtDay(start) : 'Pick a month'}</b>
			</button>
			<span className="ocustom__arrow" aria-hidden="true">
				→
			</span>
			<button type="button" className="ocustom__chip" aria-pressed={step === 'end'} onClick={() => goStep('end')} disabled={!start}>
				<small>End</small>
				<b>{end ? fmtDay(end) : start ? 'Pick a month' : '—'}</b>
			</button>
		</div>
	);

	return (
		<div className="ocustom ocustom--pop" role="dialog" aria-label="Choose the range" hidden={!open}>
			{chipsHost ? createPortal(chips, chipsHost) : chips}
			<ScopeTimeline from={start} to={end || start} year={year} onYear={setYear} viewing={view} label={step === 'start' ? 'Pick the start month' : 'Pick the end month'} onPick={(m) => setView(m)} />
			{view !== null ? <MonthCalendar year={year} month={view} start={start} end={end} min={start} step={step} onPick={pickDay} /> : <p className="ocustom__hint">{step === 'start' ? 'Pick the month the range starts in, then the day.' : 'Now pick the month it ends in, then the day.'}</p>}
		</div>
	);
}
