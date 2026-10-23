import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../components/common/Icon';
import { formatDate } from '../../../utils/dates';
import { formatNumber } from '../../../utils/format';
import { computeInsights } from '../../../utils/insights';
import { presetLabel } from '../../../utils/periods';
import { prefersReducedMotion } from '../entrance';

export const HIGHLIGHT_MS = 6000; // time on one slide before the next one slides in
const MANUAL_PAUSE_MS = 12000; // after the user picks a slide, the carousel waits longer

const initials = (name = '') =>
	name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0].toUpperCase())
		.join('') || '?';

/** The slides worth showing for this data: a slide with nothing to say is left out (never padded with zeros). */
export function buildSlides({ highlights, overview, projects, product, freshness, preset }) {
	const slides = [];
	const h = highlights || {};
	const period = presetLabel(preset);
	if (h.topPerformers && h.topPerformers.length) {
		slides.push({
			id: 'top',
			icon: 'sparkles',
			title: 'Top performers',
			sub: `Most approved hours · ${period}`,
			rows: h.topPerformers.slice(0, 3).map((p) => ({ key: p.id, name: p.name, note: p.role, value: `${formatNumber(p.hours, 1)} h` })),
		});
	}
	if (h.bestAttendance && h.bestAttendance.length) {
		slides.push({
			id: 'attendance',
			icon: 'calendar',
			title: 'Best attendance',
			sub: `Most on-time check-ins · ${period}`,
			rows: h.bestAttendance.slice(0, 3).map((p) => ({ key: p.id, name: p.name, note: p.role, value: `${p.days} ${p.days === 1 ? 'day' : 'days'}` })),
		});
	}
	if (h.newJoiners && h.newJoiners.length) {
		slides.push({
			id: 'joiners',
			icon: 'users',
			title: 'New joiners',
			sub: `Joined in the last ${h.newJoinerDays || 30} days`,
			rows: h.newJoiners.map((p) => ({ key: p.id, name: p.name, note: p.role, value: p.joinedOn ? formatDate(p.joinedOn) : '' })),
		});
	}
	const flags = computeInsights({ overview, projects, product, freshness }).filter((i) => i.tone === 'warning');
	if (flags.length) {
		slides.push({
			id: 'attention',
			icon: 'alert',
			title: flags.length === 1 ? '1 thing to watch' : `${flags.length} things to watch`,
			sub: 'Flagged from the current data',
			rows: flags.slice(0, 3).map((f) => ({ key: f.id, name: f.title, note: null, value: '', alert: true })),
		});
	}
	return slides;
}

/**
 * The dashboard's highlights card: people and moments worth a mention (top performers, best attendance, new joiners)
 * that slide by on their own, plus anything flagged. Hover or focus pauses it, the dots jump to a slide, and with
 * reduced motion it never moves by itself. Everything comes from the dashboard bundle: no request of its own.
 */
export default function Highlights({ highlights, overview, projects, product, freshness, preset }) {
	const slides = useMemo(() => buildSlides({ highlights: highlights.data, overview: overview.data, projects: projects.data, product: product.data, freshness: freshness.data, preset }), [highlights.data, overview.data, projects.data, product.data, freshness.data, preset]);
	const settled = [highlights, overview, projects, product, freshness].every((r) => r.status !== 'loading' || r.data);
	const [index, setIndex] = useState(0);
	const [hold, setHold] = useState(false); // pointer or keyboard focus is inside
	const [manualUntil, setManualUntil] = useState(0);
	const reduced = prefersReducedMotion();
	const n = slides.length;
	const at = n ? index % n : 0;
	const current = slides[at];
	const moving = n > 1 && !hold && !reduced;
	const timer = useRef(null);

	useEffect(() => {
		clearTimeout(timer.current);
		if (!moving) return undefined;
		const wait = Math.max(HIGHLIGHT_MS, manualUntil - Date.now());
		timer.current = setTimeout(() => setIndex((i) => (i + 1) % n), wait);
		return () => clearTimeout(timer.current);
	}, [moving, at, n, manualUntil]);

	const pick = useCallback((i) => {
		setIndex(i);
		setManualUntil(Date.now() + MANUAL_PAUSE_MS);
	}, []);
	const onKeyDown = (e) => {
		if (n < 2) return;
		if (e.key === 'ArrowRight') pick((at + 1) % n);
		else if (e.key === 'ArrowLeft') pick((at - 1 + n) % n);
		else return;
		e.preventDefault();
	};

	return (
		<section
			className="sig-card sig-promo sig-hl"
			aria-label="Highlights"
			aria-roledescription="carousel"
			onMouseEnter={() => setHold(true)}
			onMouseLeave={() => setHold(false)}
			onFocus={() => setHold(true)}
			onBlur={() => setHold(false)}
			onKeyDown={onKeyDown}
		>
			<span className="sig-promo__orb sig-promo__orb--a" aria-hidden="true" />
			<span className="sig-promo__orb sig-promo__orb--c" aria-hidden="true" />
			{current ? (
				<div className="sig-hl__slide" key={current.id} aria-live={moving ? 'off' : 'polite'}>
					<header className="sig-hl__head">
						<span className="sig-hl__icon" aria-hidden="true">
							<Icon name={current.icon} size={18} />
						</span>
						<div>
							<h2 className="sig-hl__title">{current.title}</h2>
							<p className="sig-hl__sub">{current.sub}</p>
						</div>
					</header>
					<ol className="sig-hl__list">
						{current.rows.map((r, i) => (
							<li key={r.key} className={`sig-hl__row ${r.alert ? 'is-alert' : ''}`.trim()} style={{ '--i': i }}>
								{r.alert ? (
									<span className="sig-hl__avatar sig-hl__avatar--alert" aria-hidden="true">
										<Icon name="alert" size={14} />
									</span>
								) : (
									<span className="sig-hl__avatar" aria-hidden="true">
										{initials(r.name)}
									</span>
								)}
								<span className="sig-hl__who">
									<b>{r.name}</b>
									{r.note ? <small>{r.note}</small> : null}
								</span>
								{r.value ? <span className="sig-hl__value">{r.value}</span> : null}
							</li>
						))}
					</ol>
				</div>
			) : (
				<div className="sig-hl__slide sig-hl__slide--empty">
					<header className="sig-hl__head">
						<span className="sig-hl__icon" aria-hidden="true">
							<Icon name="sparkles" size={18} />
						</span>
						<div>
							<h2 className="sig-hl__title">{settled ? 'Highlights' : 'Looking for highlights…'}</h2>
							<p className="sig-hl__sub">{settled ? 'Top performers, best attendance and new joiners appear here once there is approved time, check-ins or new people in this period.' : ' '}</p>
						</div>
					</header>
				</div>
			)}
			{n > 1 ? (
				<div className="sig-hl__nav">
					<div className="sig-hl__dots" role="tablist" aria-label="Highlights">
						{slides.map((s, i) => (
							<button key={s.id} type="button" role="tab" aria-selected={i === at} aria-label={s.title} className={`sig-hl__dot ${i === at ? 'is-on' : ''}`.trim()} onClick={() => pick(i)}>
								{i === at && moving ? <i key={`${s.id}-${at}`} style={{ animationDuration: `${Math.max(HIGHLIGHT_MS, manualUntil - Date.now())}ms` }} /> : null}
							</button>
						))}
					</div>
					<span className="sig-hl__hint" aria-hidden="true">
						{hold ? 'Paused' : ''}
					</span>
				</div>
			) : null}
		</section>
	);
}
