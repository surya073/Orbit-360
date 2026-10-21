import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '../common/Button';
import Icon from '../common/Icon';
import Logo from '../common/Logo';

const SPOT_PAD = 8;
const CARD_GAP = 18;
const EDGE = 16;
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

/** Where the highlighted element is on screen (null when it does not exist or is hidden, e.g. the menu on a phone). */
function useTargetRect(target) {
	const [rect, setRect] = useState(null);
	useLayoutEffect(() => {
		if (!target) {
			setRect(null);
			return undefined;
		}
		let raf = 0;
		const measure = () => {
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(() => {
				const el = document.querySelector(`[data-tour="${target}"]`);
				if (!el) return setRect(null);
				const r = el.getBoundingClientRect();
				setRect(r.width > 0 && r.height > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
			});
		};
		measure();
		window.addEventListener('resize', measure);
		window.addEventListener('scroll', measure, true);
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', measure);
			window.removeEventListener('scroll', measure, true);
		};
	}, [target]);
	return rect;
}

const firstName = (user) => String((user && user.displayName) || '').trim().split(/\s+/)[0] || '';

const TILES = [
	{ icon: 'trend', title: 'Live insights', text: 'KPIs and trends from approved data, with the gaps shown honestly.' },
	{ icon: 'present', title: 'Executive decks', text: 'Turn your records into a presentation in five premium themes.' },
	{ icon: 'lock', title: 'Secure by role', text: 'Everyone sees exactly what their role and team allow.' },
];

function Welcome({ user, onBegin, onClose }) {
	const titleId = useId();
	const ref = useRef(null);
	useEffect(() => {
		const prev = document.activeElement;
		const first = ref.current && ref.current.querySelector('[data-autofocus]');
		if (first) first.focus();
		const key = (e) => {
			if (e.key === 'Escape') onClose();
			if (e.key === 'Tab' && ref.current) {
				const items = [...ref.current.querySelectorAll('button:not([disabled])')];
				if (!items.length) return;
				const a = items[0];
				const z = items[items.length - 1];
				if (e.shiftKey && document.activeElement === a) {
					e.preventDefault();
					z.focus();
				} else if (!e.shiftKey && document.activeElement === z) {
					e.preventDefault();
					a.focus();
				}
			}
		};
		document.addEventListener('keydown', key);
		return () => {
			document.removeEventListener('keydown', key);
			if (prev && prev.focus) prev.focus();
		};
	}, [onClose]);
	const name = firstName(user);
	return (
		<div className="tour-welcome" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
			<div className="tour-welcome__orbs" aria-hidden="true">
				<i />
				<i />
				<i />
			</div>
			<div className="tour-welcome__panel">
				<Logo link={false} />
				<span className="tour-eyebrow">
					<Icon name="sparkles" size={14} /> A one-minute tour
				</span>
				<h1 id={titleId}>{name ? `Welcome, ${name}` : 'Welcome to Company 360'}</h1>
				<p className="tour-welcome__lead">Your people, projects and performance in one place. Let us show you where everything lives, so you can get to work faster.</p>
				<ul className="tour-welcome__tiles">
					{TILES.map((t, i) => (
						<li key={t.title} style={{ '--i': i }}>
							<span className="tour-chip" aria-hidden="true">
								<Icon name={t.icon} size={18} />
							</span>
							<b>{t.title}</b>
							<span>{t.text}</span>
						</li>
					))}
				</ul>
				<div className="tour-welcome__actions">
					<Button variant="primary" icon="play" onClick={onBegin} data-autofocus>
						Start the tour
					</Button>
					<Button variant="ghost" onClick={onClose}>
						Skip for now
					</Button>
				</div>
				<p className="tour-welcome__note">You can replay it any time from your account menu.</p>
			</div>
		</div>
	);
}

const TIPS = [
	{ icon: 'search', text: 'Press Ctrl K (⌘K on Mac) to search from anywhere.' },
	{ icon: 'palette', text: 'Change the theme and icon style from the palette button.' },
	{ icon: 'user', text: 'Replay this tour from your account menu whenever you like.' },
];

function Steps({ steps, index, setIndex, onClose }) {
	const titleId = useId();
	const bodyId = useId();
	const cardRef = useRef(null);
	const done = index >= steps.length;
	const step = done ? null : steps[index];
	const rect = useTargetRect(step ? step.target : null);
	const [place, setPlace] = useState({ center: true });
	const [vw, setVw] = useState(window.innerWidth); // placement depends on the screen size too
	useEffect(() => {
		const onResize = () => setVw(window.innerWidth);
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	const next = useCallback(() => setIndex((i) => Math.min(i + 1, steps.length)), [setIndex, steps.length]);
	const back = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [setIndex]);

	// Card placement: under the highlighted element (or above it), kept inside the screen; docked on phones; centred without a target.
	useLayoutEffect(() => {
		const c = cardRef.current;
		if (!c) return;
		const vh = window.innerHeight;
		if (vw < 640) return setPlace({ dock: true });
		if (!rect) return setPlace({ center: true });
		const w = c.offsetWidth;
		const h = c.offsetHeight;
		// Items in the sidebar: the card opens beside them (to the right of a left rail, to the left of a right one), level with the item.
		const railEl = document.querySelector('.rail');
		const rr = railEl ? railEl.getBoundingClientRect() : null;
		const inRail = rr && rr.width > 0 && rect.left >= rr.left - 1 && rect.left + rect.width <= rr.right + 1;
		if (inRail && rr.left > vw / 2) {
			const left = rect.left - SPOT_PAD - CARD_GAP - w;
			if (left >= EDGE) return setPlace({ top: clamp(rect.top + rect.height / 2 - h / 2, EDGE, vh - h - EDGE), left });
		} else if (rect.left + rect.width < 180) {
			const left = rect.left + rect.width + SPOT_PAD + CARD_GAP;
			if (left + c.offsetWidth <= vw - EDGE) return setPlace({ top: clamp(rect.top + rect.height / 2 - c.offsetHeight / 2, EDGE, window.innerHeight - c.offsetHeight - EDGE), left });
		}
		let top = rect.top + rect.height + SPOT_PAD + CARD_GAP;
		if (top + h > vh - EDGE) top = rect.top - SPOT_PAD - CARD_GAP - h;
		if (top < EDGE) return setPlace({ center: true });
		setPlace({ top, left: clamp(rect.left + rect.width / 2 - w / 2, EDGE, vw - w - EDGE) });
	}, [rect, index, done, vw]);

	// Keyboard: arrows move, Escape leaves, Tab stays inside the card; focus follows the step.
	useEffect(() => {
		const prev = document.activeElement;
		return () => prev && prev.focus && prev.focus();
	}, []);
	useEffect(() => {
		if (cardRef.current) cardRef.current.focus();
	}, [index]);
	useEffect(() => {
		const key = (e) => {
			if (e.key === 'Escape') onClose();
			else if (e.key === 'ArrowRight') {
				if (done) onClose();
				else next();
			}
			else if (e.key === 'ArrowLeft') back();
			else if (e.key === 'Tab' && cardRef.current) {
				const items = [...cardRef.current.querySelectorAll('button:not([disabled])')];
				if (!items.length) return;
				const a = items[0];
				const z = items[items.length - 1];
				if (e.shiftKey && (document.activeElement === a || document.activeElement === cardRef.current)) {
					e.preventDefault();
					z.focus();
				} else if (!e.shiftKey && document.activeElement === z) {
					e.preventDefault();
					a.focus();
				}
			}
		};
		document.addEventListener('keydown', key);
		return () => document.removeEventListener('keydown', key);
	}, [next, back, onClose, done]);

	const total = steps.length;
	const pct = done ? 100 : ((index + 1) / (total + 1)) * 100;
	const cardStyle = place.top !== undefined ? { top: place.top, left: place.left } : undefined;

	return (
		<div className="tour" role="presentation">
			<div className={`tour__dim ${rect ? '' : 'is-solid'}`.trim()} aria-hidden="true" />
			{rect ? <div className="tour__spot" aria-hidden="true" style={{ top: rect.top - SPOT_PAD, left: rect.left - SPOT_PAD, width: rect.width + SPOT_PAD * 2, height: rect.height + SPOT_PAD * 2 }} /> : null}
			<section ref={cardRef} className={`tour-card ${place.center ? 'is-center' : ''} ${place.dock ? 'is-dock' : ''}`.trim()} style={cardStyle} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} tabIndex={-1} key={done ? 'done' : step.id}>
				<div className="tour-card__bar" aria-hidden="true">
					<i style={{ width: `${pct}%` }} />
				</div>
				{done ? (
					<>
						<div className="tour-card__head">
							<span className="tour-chip tour-chip--success" aria-hidden="true">
								<Icon name="check" size={18} />
							</span>
							<span className="tour-card__count">Tour complete</span>
						</div>
						<h2 id={titleId}>You are all set</h2>
						<p id={bodyId}>That is the whole application. A few things worth remembering:</p>
						<ul className="tour-tips">
							{TIPS.map((t) => (
								<li key={t.text}>
									<Icon name={t.icon} size={15} /> {t.text}
								</li>
							))}
						</ul>
						<div className="tour-card__actions">
							<Button variant="ghost" onClick={back}>
								Back
							</Button>
							<Button variant="primary" onClick={onClose} data-autofocus>
								Start exploring
							</Button>
						</div>
					</>
				) : (
					<>
						<div className="tour-card__head">
							<span className="tour-chip" aria-hidden="true">
								<Icon name={step.icon} size={18} />
							</span>
							<span className="tour-card__count" aria-live="polite">
								Step {index + 1} of {total}
							</span>
						</div>
						<h2 id={titleId}>{step.title}</h2>
						<p id={bodyId}>{step.body}</p>
						{step.chips && step.chips.length ? (
							<ul className="tour-chips" aria-label="Pages inside">
								{step.chips.map((c) => (
									<li key={c}>{c}</li>
								))}
							</ul>
						) : null}
						{step.hint ? <p className="tour-card__hint">{step.hint}</p> : null}
						<div className="tour-dots" aria-hidden="true">
							{steps.map((s, i) => (
								<i key={s.id} className={i === index ? 'is-on' : i < index ? 'is-past' : ''} />
							))}
						</div>
						<div className="tour-card__actions">
							<Button variant="ghost" onClick={onClose}>
								Skip tour
							</Button>
							<span className="tour-card__spacer" />
							<Button onClick={back} disabled={index === 0}>
								Back
							</Button>
							<Button variant="primary" onClick={next} data-autofocus>
								{index === total - 1 ? 'Finish' : 'Next'}
							</Button>
						</div>
					</>
				)}
			</section>
		</div>
	);
}

/** Welcome screen, then the spotlight steps. Rendered in a portal above everything else. */
export default function TourExperience({ mode, steps, index, setIndex, user, onBegin, onClose }) {
	return createPortal(mode === 'welcome' ? <Welcome user={user} onBegin={onBegin} onClose={onClose} /> : <Steps steps={steps} index={index} setIndex={setIndex} onClose={onClose} />, document.body);
}
