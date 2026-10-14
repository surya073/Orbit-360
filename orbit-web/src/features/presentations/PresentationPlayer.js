import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import KpiCard from '../../components/cards/KpiCard';
import Button from '../../components/common/Button';
import ErrorState from '../../components/feedback/ErrorState';
import LoadingState from '../../components/feedback/LoadingState';
import StateView from '../../components/feedback/StateView';
import { ROUTES } from '../../config/routes';
import useApiResource from '../../hooks/useApiResource';
import { dashboardService } from '../../services/dashboardService';
import { presentationsService } from '../../services/presentationsService';
import { formatNumber, minutesToHours } from '../../utils/format';
import { presetLabel, resolvePeriod } from '../../utils/periods';
import useDashboardData from '../dashboard/useDashboardData';
import FreshnessBar from '../dashboard/widgets/FreshnessBar';
import { SECTION_RENDERERS, sectionsNeeded } from './sections';

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

/**
 * Full-screen presentation, separate from the app shell. Sections render live data for the
 * deck's saved period and filters; every request is authorized for the VIEWER by the backend
 * (a manager cannot see another team's numbers even if the deck was saved by an admin).
 * Keys: ← → PageUp PageDown Space Home End to move, Esc to exit.
 */
export default function PresentationPlayer() {
	const { id } = useParams();
	const navigate = useNavigate();
	const stage = useRef(null);
	const deck = useApiResource((signal) => presentationsService.get(id, { signal }), `deck|${id}`, { isEmpty: () => false });
	const [index, setIndex] = useState(0);
	const marked = useRef(false);

	const config = deck.data && deck.data.config;
	const slides = useMemo(() => (config ? config.slides : []), [config]);
	const period = config ? resolvePeriod(config.period) : null;
	const params = useMemo(() => (config && period ? { ...period, ...(config.filters && config.filters.teamId ? { team_id: config.filters.teamId } : {}), ...(config.filters && config.filters.projectId ? { project_id: config.filters.projectId } : {}) } : {}), [config, period && period.from, period && period.to]); // eslint-disable-line react-hooks/exhaustive-deps
	const data = useDashboardData(params, { enabled: Boolean(config), sections: config ? sectionsNeeded(slides) : [] });

	const exit = useCallback(() => navigate(ROUTES.presentations), [navigate]);
	const last = Math.max(slides.length - 1, 0);

	useEffect(() => {
		if (deck.data && !marked.current) {
			marked.current = true;
			presentationsService.markPresented(id).catch(() => {});
		}
	}, [deck.data, id]);
	useEffect(() => {
		stage.current && stage.current.focus();
	}, [index, deck.data]);

	const onKeyDown = (e) => {
		if (e.target.closest('button, a, input, select, textarea') && (e.key === ' ' || e.key === 'Enter')) return;
		const go = (n) => {
			e.preventDefault();
			setIndex(Math.min(Math.max(n, 0), last));
		};
		if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') go(index + 1);
		else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(index - 1);
		else if (e.key === 'Home') go(0);
		else if (e.key === 'End') go(last);
		else if (e.key === 'Escape') exit();
	};

	const slide = slides[index];
	const renderer = slide && slide.type === 'section' ? SECTION_RENDERERS[slide.section] : null;

	return (
		<div className="present" role="dialog" aria-modal="true" aria-label={deck.data ? `Presentation: ${deck.data.title}` : 'Presentation'} onKeyDown={onKeyDown}>
			<div className="present__bar">
				<strong>{deck.data ? deck.data.title : 'Presentation'}</strong>
				<span className="muted" aria-live="polite">
					{slides.length ? `Slide ${index + 1} of ${slides.length}` : ''}
				</span>
				<span style={{ flex: 1 }} />
				<Button size="sm" icon="chevronLeft" disabled={index === 0} onClick={() => setIndex((i) => Math.max(i - 1, 0))} aria-label="Previous slide">
					Previous
				</Button>
				<Button size="sm" disabled={index >= last} onClick={() => setIndex((i) => Math.min(i + 1, last))} aria-label="Next slide">
					Next
				</Button>
				<Button size="sm" variant="primary" icon="x" onClick={exit}>
					Exit
				</Button>
			</div>
			<div className="present__progress" aria-hidden="true">
				<i style={{ width: slides.length ? `${((index + 1) / slides.length) * 100}%` : 0 }} />
			</div>

			<div className="present__stage" ref={stage} tabIndex={-1}>
				{deck.status === 'loading' && !deck.data ? (
					<LoadingState lines={5} />
				) : deck.status === 'error' ? (
					<ErrorState error={deck.error} onRetry={deck.reload} />
				) : !deck.data.slidesAvailable ? (
					<p className="banner banner--warning">This presentation could not be read.</p>
				) : !slide ? (
					<p className="muted">This presentation has no slides.</p>
				) : (
					<section className="present__slide" key={index} aria-label={`Slide ${index + 1}`}>
						<h1>{slide.title || (renderer ? renderer.title : 'Slide')}</h1>
						{renderer ? <p className="lead">{renderer.lead}</p> : null}
						{renderer ? renderer.render(data) : null}
						{slide.type === 'text' || slide.type === 'title' ? <p style={{ fontSize: 'var(--fs-lg)', whiteSpace: 'pre-wrap' }}>{slide.body}</p> : null}
						{slide.type === 'snapshot' ? <SnapshotSlide snapshotId={slide.snapshotId} /> : null}
					</section>
				)}
			</div>

			<div className="present__foot">
				{period ? (
					<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
						<strong>{presetLabel(config.period.preset)}</strong>
						<FreshnessBar res={data.freshness} period={period} />
					</div>
				) : null}
				<span style={{ flex: 1 }} />
				<span>← → to navigate · Esc to exit</span>
			</div>
		</div>
	);
}
