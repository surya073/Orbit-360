import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import KpiCard from '../../components/cards/KpiCard';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import Popover from '../../components/common/Popover';
import ErrorState from '../../components/feedback/ErrorState';
import LoadingState from '../../components/feedback/LoadingState';
import StateView from '../../components/feedback/StateView';
import { ROUTES } from '../../config/routes';
import useApiResource from '../../hooks/useApiResource';
import useLookupLabels from '../../hooks/useLookup';
import { dashboardService } from '../../services/dashboardService';
import { presentationsService } from '../../services/presentationsService';
import { reportingService } from '../../services/reportingService';
import { resourceService } from '../../services/resourceService';
import { formatDate, formatDateTime } from '../../utils/dates';
import { formatNumber, minutesToHours } from '../../utils/format';
import { presetLabel, resolvePeriod } from '../../utils/periods';
import useDashboardData from '../dashboard/useDashboardData';
import FreshnessBar from '../dashboard/widgets/FreshnessBar';
import { buildSlides, detailOptions, PEOPLE_LIMIT, PROFILE_LIMIT, RECORDS_LIMIT } from './deckSlides';
import { PRESENTATION_THEMES, readStoredOptions, readStoredTheme, readStoredTransition, storeTheme, storeTransition, THEME_IDS, TRANSITIONS, themeById, themeStyle } from './presentationThemes';
import { EntranceContext } from '../dashboard/entrance';
import { LAYOUTS, LAYOUT_IDS, layoutById, readStoredLayout, storeLayout } from './presentationTemplates';
import { SCENE_CHOICES, readStoredScene, sceneFor, storeScene } from './presentationScenes';
import { motionReduced } from '../../utils/motion';
import { Brand, ClosingSlide, DetailStateSlide, OpeningSlide, PeopleSlide, ProfileSlide, RecordsSlide, SlideFrame, TextSlide } from './PresentationSlides';
import { ReportingSlide, ReportingStateSlide } from './ReportingSlide';
import { buildReportingModel } from './reportingSlides';
import { SECTION_RENDERERS, sectionsNeeded } from './sections';

const CANVAS_W = 1920;
const CANVAS_H = 1080;
const LOOKUP_COLUMNS = ['primary_team_id', 'reports_to_employee_id', 'team_id'];
const KICKER = {
	executive_summary: 'Overview',
	employee_overview: 'People',
	attendance_leave: 'People',
	project_performance: 'Delivery',
	billable_hours: 'Performance',
	product_development: 'Product',
	ai_usage: 'Tools',
	key_insights: 'Findings',
};

/** Legacy v1 slides (frozen snapshots) still play. */
function SnapshotSlide({ snapshotId }) {
	const res = useApiResource((signal) => dashboardService.getSnapshot(snapshotId, { signal }), `snap|${snapshotId}`, { isEmpty: () => false });
	const t = res.data && res.data.summaryAvailable && res.data.summary.time;
	return (
		<StateView res={res}>
			{t ? (
				<div className="grid grid--kpi">
					<KpiCard label="Billable hours" unit="h" value={formatNumber(minutesToHours(t.billableMinutes), 1)} metric={t} />
					<KpiCard label="Non-billable hours" unit="h" value={formatNumber(minutesToHours(t.nonBillableMinutes), 1)} />
				</div>
			) : (
				<p className="banner banner--warning">This snapshot is no longer available.</p>
			)}
		</StateView>
	);
}

/** Scale of the fixed 1920x1080 canvas that fits the viewport (letterboxed, never distorted). */
function useFitScale(ref) {
	const [box, setBox] = useState(() => ({ w: window.innerWidth || CANVAS_W, h: window.innerHeight || CANVAS_H }));
	useLayoutEffect(() => {
		const node = ref.current;
		const measure = () => {
			const w = (node && node.clientWidth) || window.innerWidth || CANVAS_W;
			const h = (node && node.clientHeight) || window.innerHeight || CANVAS_H;
			setBox((b) => (b.w === w && b.h === h ? b : { w, h }));
		};
		measure();
		let ro;
		if (typeof ResizeObserver !== 'undefined' && node) {
			ro = new ResizeObserver(measure);
			ro.observe(node);
		}
		window.addEventListener('resize', measure);
		return () => {
			if (ro) ro.disconnect();
			window.removeEventListener('resize', measure);
		};
	}, [ref]);
	return Math.max(Math.min(box.w / CANVAS_W, box.h / CANVAS_H), 0.1);
}

const queryFlag = (sp, key, fallback) => (sp.has(key) ? sp.get(key) === '1' : fallback);

/**
 * Immersive presentation viewer, separate from the app shell. The saved deck is wrapped in a
 * generated opening and closing slide; sections render live data for the deck's saved period and
 * filters (every request is authorized for the VIEWER by the backend). Optional people / project
 * detail slides come from the real record endpoints. The theme is applied to every slide.
 * Keys: ← → PageUp PageDown Space Home End to move, F fullscreen, Esc to exit.
 */
const AUTO_MS = 7000; // how long each slide stays in auto-play

export default function PresentationPlayer() {
	const { can: allowed } = useAuth(); // permissions: which optional detail slides this viewer may load
	const { id } = useParams();
	const navigate = useNavigate();
	const [sp] = useSearchParams();
	const rootRef = useRef(null);
	const viewportRef = useRef(null);
	const deck = useApiResource((signal) => presentationsService.get(id, { signal }), `deck|${id}`, { isEmpty: () => false });
	const [nav, setNav] = useState({ index: 0, dir: 'next' });
	const [theme, setTheme] = useState(() => (THEME_IDS.includes(sp.get('theme')) ? sp.get('theme') : readStoredTheme()));
	const stored = useMemo(() => readStoredOptions(), []);
	const wantPeople = queryFlag(sp, 'people', stored.people);
	const wantRecords = queryFlag(sp, 'records', stored.records);
	const wantReportingExtra = queryFlag(sp, 'reporting', stored.reporting);
	const marked = useRef(false);
	const [fullscreen, setFullscreen] = useState(false);
	const [layout, setLayout] = useState(() => (LAYOUT_IDS.includes(sp.get('layout')) ? sp.get('layout') : readStoredLayout()));
	const [transition, setTransition] = useState(readStoredTransition); // 'auto' = the template's own
	const [scene, setScene] = useState(readStoredScene); // how a slide's content enters; 'auto' = a different one per slide
	const [auto, setAuto] = useState(false); // auto-play: advance every AUTO_MS
	const [chrome, setChrome] = useState(true);
	const hideTimer = useRef(null);

	const config = deck.data && deck.data.config;
	const slides = useMemo(() => (config ? config.slides : []), [config]);
	const filters = (config && config.filters) || {};
	const period = config ? resolvePeriod(config.period) : null;
	const params = useMemo(() => (config && period ? { ...period, ...(filters.teamId ? { team_id: filters.teamId } : {}), ...(filters.projectId ? { project_id: filters.projectId } : {}) } : {}), [config, period && period.from, period && period.to]); // eslint-disable-line react-hooks/exhaustive-deps
	const data = useDashboardData(params, { enabled: Boolean(config), sections: config ? sectionsNeeded(slides) : [] });

	// Optional detail datasets: fetched once, only when the deck has the matching section and the option is on.
	const can = useMemo(() => detailOptions(slides), [slides]);
	const peopleOn = Boolean(config) && wantPeople && can.people && allowed('employees.view');
	const recordsOn = Boolean(config) && wantRecords && can.records && allowed('projects.view');
	const scope = filters.teamId ? { team_id: filters.teamId } : {}; // managers are pinned to their team by the backend either way
	const people = useApiResource((signal) => resourceService.list('employees', { page: 1, pageSize: PEOPLE_LIMIT, ...scope }, { signal }), `pv|${filters.teamId || ''}`, { enabled: peopleOn, isEmpty: () => false });
	const records = useApiResource((signal) => resourceService.list('projects', { page: 1, pageSize: RECORDS_LIMIT, ...scope, ...(filters.projectId ? { ids: filters.projectId } : {}) }, { signal }), `rv|${filters.teamId || ''}|${filters.projectId || ''}`, { enabled: recordsOn, isEmpty: () => false });
	// Per-person activity for the profile slides: ONE request for the profiled people, after the people list is in.
	const profileIds = useMemo(() => (people.status === 'success' && people.data ? people.data.slice(0, PROFILE_LIMIT).map((p) => String(p.ROWID)) : []), [people.status, people.data]);
	const profiles = useApiResource(
		(signal) => dashboardService.peopleProfiles({ from: params.from, to: params.to, ...(filters.teamId ? { team_id: filters.teamId } : {}), employee_ids: profileIds.join(',') }, { signal }),
		`pf|${filters.teamId || ''}|${params.from}|${params.to}|${profileIds.join(',')}`,
		{ enabled: peopleOn && profileIds.length > 0, isEmpty: () => false }
	);
	const lookupRows = useMemo(() => [...(people.data || []), ...(records.data || [])], [people.data, records.data]);
	const labelOf = useLookupLabels(lookupRows, LOOKUP_COLUMNS);

	// Saved reporting tree: fetched once, only when the deck has the Team reporting structure section.
	const hasReportingSection = useMemo(() => slides.some((s) => s.type === 'section' && s.section === 'reporting_structure'), [slides]);
	const addReporting = Boolean(config) && wantReportingExtra && !hasReportingSection && allowed('reporting.view') && allowed('employees.view');
	const wantReporting = hasReportingSection || addReporting;
	const reportingRes = useApiResource((signal) => reportingService.get(filters.teamId || '', { signal }), `rp|${filters.teamId || ''}`, { enabled: Boolean(config) && wantReporting, isEmpty: () => false });
	const reporting = useMemo(() => (wantReporting ? { status: reportingRes.status, error: reportingRes.error, model: buildReportingModel(reportingRes.data) } : null), [wantReporting, reportingRes.status, reportingRes.error, reportingRes.data]);

	const list = useMemo(
		() => buildSlides(slides, { people: peopleOn ? { status: people.status, data: people.data, meta: people.meta, error: people.error } : null, records: recordsOn ? { status: records.status, data: records.data, meta: records.meta, error: records.error } : null, wantPeople: peopleOn, wantRecords: recordsOn, reporting, addReporting, profiles: peopleOn ? { status: profileIds.length ? profiles.status : 'loading', data: profiles.data, error: profiles.error } : null }),
		[slides, peopleOn, recordsOn, reporting, addReporting, profiles.status, profiles.data, profiles.error, profileIds.length, people.status, people.data, people.meta, people.error, records.status, records.data, records.meta, records.error]
	);
	const hasSlides = slides.length > 0;
	const last = Math.max(list.length - 1, 0);
	const index = Math.min(nav.index, last);
	const entry = hasSlides ? list[index] : null;

	const goTo = useCallback(
		(n) =>
			setNav((s) => {
				const clamped = Math.min(Math.max(n, 0), last);
				return clamped === s.index ? s : { index: clamped, dir: clamped > s.index ? 'next' : 'prev' };
			}),
		[last]
	);
	const exit = useCallback(() => navigate(ROUTES.presentations), [navigate]);
	const pickTransition = useCallback((id) => {
		setTransition(id);
		storeTransition(id);
	}, []);

	// Auto-play: each slide stays for AUTO_MS, then the next one arrives; it stops by itself on the last slide.
	useEffect(() => {
		if (!auto) return undefined;
		if (index >= last) {
			setAuto(false);
			return undefined;
		}
		const timer = setTimeout(() => goTo(index + 1), AUTO_MS);
		return () => clearTimeout(timer);
	}, [auto, index, last, goTo]);

	const toggleFullscreen = useCallback(() => {
		try {
			if (document.fullscreenElement) document.exitFullscreen();
			else if (rootRef.current && rootRef.current.requestFullscreen) rootRef.current.requestFullscreen();
		} catch {
			/* fullscreen refused by the browser: stay in the window */
		}
	}, []);
	useEffect(() => {
		const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
		document.addEventListener('fullscreenchange', onChange);
		return () => document.removeEventListener('fullscreenchange', onChange);
	}, []);

	useEffect(() => {
		if (deck.data && !marked.current) {
			marked.current = true;
			presentationsService.markPresented(id).catch(() => {});
		}
	}, [deck.data, id]);

	// One keyboard listener for the whole viewer. It reads the latest state through a ref so it is
	// registered once (no duplicate handlers) and ignores keys meant for inputs and focused buttons.
	const live = useRef({});
	live.current = { index, last, goTo, exit, toggleFullscreen, toggleAuto: () => setAuto((a) => !a), cycleTransition: () => setTransition((cur) => { const ids = TRANSITIONS.map((x) => x.id); const next = ids[(ids.indexOf(cur) + 1) % ids.length]; storeTransition(next); return next; }) };
	useEffect(() => {
		const onKey = (e) => {
			if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
			const t = e.target;
			if (t && t.closest && t.closest('input, select, textarea, [contenteditable="true"]')) return;
			if (t && t.closest && t.closest('button, a') && (e.key === ' ' || e.key === 'Enter')) return;
			const { index: i, last: l, goTo: go, exit: leave, toggleFullscreen: fs, toggleAuto, cycleTransition } = live.current;
			const move = (n) => {
				e.preventDefault();
				go(n);
			};
			if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') move(i + 1);
			else if (e.key === 'ArrowLeft' || e.key === 'PageUp') move(i - 1);
			else if (e.key === 'Home') move(0);
			else if (e.key === 'End') move(l);
			else if (e.key === 'a' || e.key === 'A') {
				e.preventDefault();
				toggleAuto();
			} else if (e.key === 't' || e.key === 'T') {
				e.preventDefault();
				cycleTransition();
			} else if (e.key === 'f' || e.key === 'F') {
				e.preventDefault();
				fs();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
				else leave();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	// Auto-hiding toolbar: shown on movement or focus, hidden after a short idle.
	const wake = useCallback(() => {
		setChrome(true);
		clearTimeout(hideTimer.current);
		hideTimer.current = setTimeout(() => {
			if (rootRef.current && rootRef.current.querySelector('.pres__toolbar:focus-within, .pres__toolbar .popover')) return;
			setChrome(false);
		}, 3200);
	}, []);
	useEffect(() => {
		wake();
		return () => clearTimeout(hideTimer.current);
	}, [wake]);

	const scale = useFitScale(viewportRef);
	// The ambient glow leans a little toward the pointer (a CSS variable, so no re-render per mouse move).
	const lean = useCallback((e) => {
		const el = rootRef.current;
		if (!el || motionReduced()) return;
		const r = el.getBoundingClientRect();
		el.style.setProperty('--px', String(((e.clientX - r.left) / r.width - 0.5) * 2));
		el.style.setProperty('--py', String(((e.clientY - r.top) / r.height - 0.5) * 2));
	}, []);
	const t = themeById(theme);
	const pickTheme = (tid) => {
		setTheme(tid);
		storeTheme(tid);
	};

	const periodText = config ? presetLabel(config.period.preset) : '';
	const rangeText = period ? `${formatDate(period.from)} – ${formatDate(period.to)}` : '';
	const title = deck.data ? deck.data.title : 'Presentation';
	const now = new Date();

	const reportingSlide = slides.find((s) => s.type === 'section' && s.section === 'reporting_structure');
	const reportingTitle = (reportingSlide && reportingSlide.title) || 'Team reporting structure';

	function renderEntry(e) {
		if (e.kind === 'opening') return <OpeningSlide title={title} periodText={periodText} rangeText={rangeText} dateText={formatDate(now.toISOString().slice(0, 10))} />;
		if (e.kind === 'closing') return <ClosingSlide title={title} periodText={periodText} rangeText={rangeText} generatedText={formatDateTime(now.toISOString().slice(0, 19).replace('T', ' '))} />;
		if (e.kind === 'people') return <PeopleSlide slide={e} labelOf={labelOf} />;
		if (e.kind === 'profile') return <ProfileSlide slide={e} labelOf={labelOf} />;
		if (e.kind === 'records') return <RecordsSlide slide={e} labelOf={labelOf} />;
		if (e.kind === 'reporting') return <ReportingSlide slide={e} title={reportingTitle} />;
		if (e.kind === 'reporting-state') return <ReportingStateSlide slide={e} title={reportingTitle} onRetry={reportingRes.reload} />;
		if (e.kind === 'detail-state') return <DetailStateSlide slide={e} onRetry={e.topic === 'people' ? people.reload : records.reload} />;
		const s = e.slide;
		const renderer = s.type === 'section' ? SECTION_RENDERERS[s.section] : null;
		if (renderer) {
			return (
				<SlideFrame kicker={KICKER[s.section]} title={s.title || renderer.title} lead={renderer.lead}>
					{renderer.render(data)}
				</SlideFrame>
			);
		}
		if (s.type === 'snapshot') {
			return (
				<SlideFrame kicker="Snapshot" title={s.title || 'Snapshot'}>
					<SnapshotSlide snapshotId={s.snapshotId} />
				</SlideFrame>
			);
		}
		return <TextSlide title={s.title} body={s.body} />;
	}

	const cover = entry && (entry.kind === 'opening' || entry.kind === 'closing');
	const total = list.length;

	return (
		<div
			className="pres pscope"
			ref={rootRef}
			data-ptheme={t.id}
			data-pscheme={t.dark ? 'dark' : 'light'}
			data-playout={layout}
			data-chrome={chrome ? 'on' : 'off'}
			style={themeStyle(t)}
			role="dialog"
			aria-modal="true"
			aria-label={deck.data ? `Presentation: ${deck.data.title}` : 'Presentation'}
			onMouseMove={(e) => {
				wake();
				lean(e);
			}}
			onPointerDown={wake}
			onFocus={wake}
		>
			<div className="pres__progress" aria-hidden="true">
				<i style={{ width: hasSlides && total ? `${((index + 1) / total) * 100}%` : 0 }} />
			</div>
			{auto ? <span className="pres__auto" key={index} style={{ animationDuration: `${AUTO_MS}ms` }} aria-hidden="true" /> : null}

			<div className="pres__viewport" ref={viewportRef}>
				<div className="pres__canvas" style={{ width: CANVAS_W, height: CANVAS_H, transform: `translate(-50%, -50%) scale(${scale})` }}>
					<div className="pres__ambient" aria-hidden="true">
						<i />
						<i />
						<i />
					</div>
					{deck.status === 'loading' && !deck.data ? (
						<div className="pres__state">
							<LoadingState lines={5} />
						</div>
					) : deck.status === 'error' ? (
						<div className="pres__state">
							<ErrorState error={deck.error} onRetry={deck.reload} />
						</div>
					) : !deck.data.slidesAvailable ? (
						<div className="pres__state">
							<p className="banner banner--warning">This presentation could not be read.</p>
						</div>
					) : !hasSlides ? (
						<div className="pres__state">
							<p className="muted">This presentation has no slides.</p>
						</div>
					) : (
						<section className={`pslide pslide--${entry.kind} is-${nav.dir}`} data-ptrans={transition === 'auto' ? t.motion : transition} data-pscene={sceneFor(scene, index)} key={`${index}-${entry.kind}`} aria-label={`Slide ${index + 1}`}>
							<div className="pdecor" aria-hidden="true">
								<i />
								<i />
								<i />
								<i />
							</div>
							<EntranceContext.Provider value={true}>{renderEntry(entry)}</EntranceContext.Provider>
							{cover ? null : (
								<footer className="pslide__foot">
									<Brand size={22} />
									<span className="pslide__period">
										<strong>{periodText}</strong>
										<FreshnessBar res={data.freshness} period={period} />
									</span>
									<span className="pslide__num">
										{index + 1} / {total}
									</span>
								</footer>
							)}
						</section>
					)}
				</div>
			</div>

			<div className="pres__toolbar" role="toolbar" aria-label="Presentation controls">
				<strong className="pres__title">{title}</strong>
				<span className="pres__count" aria-live="polite">
					{hasSlides ? `Slide ${index + 1} of ${total}` : ''}
				</span>
				<span className="pres__spacer" />
				<Button size="sm" icon="chevronLeft" disabled={index === 0} onClick={() => goTo(index - 1)} aria-label="Previous slide">
					Previous
				</Button>
				<Button size="sm" disabled={index >= last} onClick={() => goTo(index + 1)} aria-label="Next slide">
					Next
				</Button>
				<Popover
					label="Slide layout"
					align="right"
					placement="up"
					trigger={({ toggle, props }) => (
						<Button size="sm" icon="dashboard" onClick={toggle} {...props} aria-label={`Layout: ${layoutById(layout).label}`}>
							Layout
						</Button>
					)}
				>
					{({ close }) => (
						<ul className="pres__themes">
							{LAYOUTS.map((l) => (
								<li key={l.id}>
									<button
										type="button"
										className={`menu-item ${l.id === layout ? 'active' : ''}`.trim()}
										aria-pressed={l.id === layout}
										onClick={() => {
											setLayout(l.id);
											storeLayout(l.id);
											close();
										}}
									>
										<span>{l.label}</span>
										{l.id === layout ? <Icon name="check" size={14} /> : null}
									</button>
								</li>
							))}
						</ul>
					)}
				</Popover>
				<Popover
					label="Slide animation"
					align="right"
					placement="up"
					trigger={({ toggle, props }) => (
						<Button size="sm" icon="trend" onClick={toggle} {...props} aria-label={`Animation: ${(SCENE_CHOICES.find((x) => x.id === scene) || SCENE_CHOICES[0]).label}`}>
							Animation
						</Button>
					)}
				>
					{({ close }) => (
						<ul className="pres__themes">
							{SCENE_CHOICES.map((x) => (
								<li key={x.id}>
									<button
										type="button"
										className={`menu-item ${x.id === scene ? 'active' : ''}`.trim()}
										aria-pressed={x.id === scene}
										onClick={() => {
											setScene(x.id);
											storeScene(x.id);
											close();
										}}
									>
										<span>
											{x.label}
											<small className="pscene-hint">{x.description}</small>
										</span>
										{x.id === scene ? <Icon name="check" size={14} /> : null}
									</button>
								</li>
							))}
						</ul>
					)}
				</Popover>
				<Popover
					label="Slide transition"
					align="right"
					placement="up"
					trigger={({ toggle, props }) => (
						<Button size="sm" icon="sparkles" onClick={toggle} {...props} aria-label={`Transition: ${(TRANSITIONS.find((x) => x.id === transition) || TRANSITIONS[0]).label}`}>
							Motion
						</Button>
					)}
				>
					{({ close }) => (
						<ul className="pres__themes">
							{TRANSITIONS.map((x) => (
								<li key={x.id}>
									<button
										type="button"
										className={`menu-item ${x.id === transition ? 'active' : ''}`.trim()}
										aria-pressed={x.id === transition}
										onClick={() => {
											pickTransition(x.id);
											close();
										}}
									>
										<span>{x.id === 'auto' ? `${x.label} (${(TRANSITIONS.find((y) => y.id === t.motion) || TRANSITIONS[1]).label})` : x.label}</span>
										{x.id === transition ? <Icon name="check" size={14} /> : null}
									</button>
								</li>
							))}
						</ul>
					)}
				</Popover>
				<Button size="sm" icon="play" aria-pressed={auto} onClick={() => setAuto((a) => !a)} disabled={!hasSlides || index >= last} title="Advance by itself (A)">
					{auto ? 'Pause' : 'Auto-play'}
				</Button>
				<Popover
					label="Presentation theme"
					align="right"
					placement="up"
					trigger={({ toggle, props }) => (
						<Button size="sm" icon="palette" onClick={toggle} {...props} aria-label={`Theme: ${t.name}`}>
							Theme
						</Button>
					)}
				>
					{({ close }) => (
						<ul className="pres__themes">
							{PRESENTATION_THEMES.map((th) => (
								<li key={th.id}>
									<button
										type="button"
										className={`menu-item ${th.id === theme ? 'active' : ''}`.trim()}
										aria-pressed={th.id === theme}
										onClick={() => {
											pickTheme(th.id);
											close();
										}}
									>
										<span className="pres__swatch" style={{ background: `linear-gradient(135deg, ${th.swatches[1]}, ${th.swatches[3]})` }} aria-hidden="true" />
										<span>{th.name}</span>
										{th.id === theme ? <Icon name="check" size={14} /> : null}
									</button>
								</li>
							))}
						</ul>
					)}
				</Popover>
				{typeof document !== 'undefined' && document.fullscreenEnabled ? (
					<Button size="sm" icon="present" onClick={toggleFullscreen} aria-pressed={fullscreen}>
						{fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
					</Button>
				) : null}
				<Button size="sm" variant="primary" icon="x" onClick={exit}>
					Exit
				</Button>
			</div>
		</div>
	);
}
