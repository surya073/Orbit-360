import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import Button from '../../components/common/Button';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Icon from '../../components/common/Icon';
import StateView from '../../components/feedback/StateView';
import { useToast } from '../../components/feedback/ToastProvider';
import Pagination from '../../components/tables/Pagination';
import { ROUTES } from '../../config/routes';
import useApiResource from '../../hooks/useApiResource';
import useLookupLabels from '../../hooks/useLookup';
import usePageSize from '../../hooks/usePageSize';
import { presentationsService } from '../../services/presentationsService';
import { formatDateTime } from '../../utils/dates';
import { EMPTY } from '../../utils/format';
import PresentationLauncher from './PresentationLauncher';
import { PRESENTATION_THEMES, readStoredTheme, themeById, themeStyle } from './presentationThemes';
import ThemePreview from './ThemePreview';

const FK = ['team_id'];

export const presentUrl = ({ id, theme, layout = 'classic', people, records, reporting, story }) => `${ROUTES.present(id)}?theme=${theme}&layout=${layout}&people=${people ? 1 : 0}&records=${records ? 1 : 0}&reporting=${reporting ? 1 : 0}${story && story !== 'saved' ? `&story=${story}` : ''}`;

/**
 * Executive presentation center: a studio-style landing page. Saved decks the caller may open
 * (their team's for managers, all for admins) are shown as preview cards; Play opens the
 * launcher where the theme is chosen before anything plays.
 */
export default function PresentationsPage() {
	const { notify } = useToast();
	const { can } = useAuth();
	const navigate = useNavigate();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = usePageSize('presentations');
	const [target, setTarget] = useState(null);
	const [launch, setLaunch] = useState(null); // { id } while the launcher is open
	const [theme, setTheme] = useState(readStoredTheme);
	const res = useApiResource((signal) => presentationsService.list({ page, pageSize }, { signal }), `p|${page}|${pageSize}`, { isEmpty: () => false });
	const labelOf = useLookupLabels(res.data, FK);
	const rows = res.data || [];
	const t = themeById(theme);
	const first = rows[0];

	return (
		<div className="pc">
			<section className="pc-hero pscope" data-ptheme={t.id} style={themeStyle(t)} aria-labelledby="pc-title">
				<div className="pc-hero__ambient" aria-hidden="true">
					<i />
					<i />
				</div>
				<div className="pc-hero__text">
					<span className="pc-eyebrow">
						<Icon name="present" size={15} /> Executive presentation center
					</span>
					<h1 id="pc-title">Executive briefings, straight from live data</h1>
					<p>Build a deck once, then present it to leadership any time. Every number is read from your records when you play, within your own access.</p>
					<div className="pc-hero__actions">
						<Button variant="primary" icon="play" className="pc-play" onClick={() => first && setLaunch({ id: String(first.ROWID) })} disabled={!first} title={first ? undefined : 'Create a presentation first'}>
							Play Presentation
						</Button>
						{can('presentations.create') ? (
							<Button icon="plus" to={ROUTES.presentationNew}>
								New presentation
							</Button>
						) : null}
					</div>
					<ul className="pc-points">
						<li>
							<Icon name="sparkles" size={15} /> {PRESENTATION_THEMES.length} cinematic themes
						</li>
						<li>
							<Icon name="lock" size={15} /> Scoped to your access
						</li>
						<li>
							<Icon name="play" size={15} /> Keyboard and fullscreen
						</li>
					</ul>
				</div>
				<div className="pc-hero__stage" aria-hidden="true">
					<ThemePreview theme={t} title={first ? first.title : 'Your next briefing'} className="pc-hero__card pc-hero__card--a" />
					<ThemePreview theme={t} kind="content" className="pc-hero__card pc-hero__card--b" />
				</div>
			</section>

			<section className="pc-list" aria-labelledby="pc-list-title">
				<div className="pc-list__head">
					<h2 id="pc-list-title">Your presentations</h2>
					{res.meta ? <span className="muted small">{res.meta.total} saved</span> : null}
				</div>
				<StateView res={res} loadingLines={4}>
					{rows.length === 0 ? (
						<div className="pc-empty">
							<div className="state__title">No presentations yet</div>
							<p>Pick the sections, reporting period and filters, then save the deck to present it again any time.</p>
							{can('presentations.create') ? (
								<Button variant="primary" icon="plus" to={ROUTES.presentationNew}>
									Create a presentation
								</Button>
							) : null}
						</div>
					) : (
						<>
							<ul className="pc-grid">
								{rows.map((row, i) => (
									<li key={row.ROWID} className="pc-card" style={{ '--i': i }}>
										<ThemePreview theme={t} title={row.title} className="pc-card__thumb" />
										<div className="pc-card__body">
											<h3>{row.title}</h3>
											<p className="pc-card__meta">
												<span className={`ppill ppill--${row.status === 'ready' ? 'good' : 'neutral'}`}>{row.status === 'ready' ? 'Ready' : 'Draft'}</span>
												<span>{row.team_id ? labelOf('team_id', row.team_id) : 'All teams'}</span>
											</p>
											<p className="pc-card__dates">
												<span>Last presented {row.last_presented_at ? formatDateTime(row.last_presented_at) : EMPTY}</span>
												<span>Updated {formatDateTime(row.MODIFIEDTIME)}</span>
											</p>
											<div className="pc-card__actions">
												<Button size="sm" variant="primary" icon="play" aria-label={`Present ${row.title}`} onClick={() => setLaunch({ id: String(row.ROWID) })}>
													Present
												</Button>
												{can('presentations.edit') ? (
													<Button size="sm" icon="edit" to={ROUTES.presentationEdit(row.ROWID)} aria-label={`Edit ${row.title}`}>
														Edit
													</Button>
												) : null}
												{can('presentations.delete') ? (
													<Button size="sm" variant="ghost" icon="trash" aria-label={`Delete ${row.title}`} onClick={() => setTarget(row)}>
														Delete
													</Button>
												) : null}
											</div>
										</div>
									</li>
								))}
							</ul>
							<Pagination
								meta={res.meta}
								onPage={setPage}
								pageSize={pageSize}
								onPageSize={(n) => {
									setPageSize(n);
									setPage(1);
								}}
							/>
						</>
					)}
				</StateView>
			</section>

			{launch ? (
				<PresentationLauncher
					decks={rows}
					initialId={launch.id}
					onClose={() => {
						setLaunch(null);
						setTheme(readStoredTheme());
					}}
					onStart={(o) => navigate(presentUrl(o))}
				/>
			) : null}
			{target ? (
				<ConfirmDialog
					title={`Delete “${target.title}”?`}
					message="The saved presentation is removed. Your data is not affected."
					onCancel={() => setTarget(null)}
					onConfirm={async () => {
						await presentationsService.remove(target.ROWID);
						setTarget(null);
						notify('Presentation deleted');
						res.reload();
					}}
				/>
			) : null}
		</div>
	);
}
