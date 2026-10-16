import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import Card from '../../components/cards/Card';
import Button from '../../components/common/Button';
import SortableList from '../../components/common/SortableList';
import StateView from '../../components/feedback/StateView';
import { useToast } from '../../components/feedback/ToastProvider';
import DateRangeFilter, { isValidPeriod } from '../../components/filters/DateRangeFilter';
import ProjectFilter from '../../components/filters/ProjectFilter';
import TeamFilter from '../../components/filters/TeamFilter';
import Field from '../../components/forms/Field';
import PageHeader from '../../components/layout/PageHeader';
import { REPORT_SECTIONS } from '../../config/constants';
import { ROUTES } from '../../config/routes';
import useApiResource from '../../hooks/useApiResource';
import { presentationsService } from '../../services/presentationsService';
import Select from '../../components/forms/Select';

const LABEL = Object.fromEntries(REPORT_SECTIONS.map((s) => [s.key, s.label]));
const slideLabel = (s) => (s.type === 'section' ? LABEL[s.section] || s.section : s.title || `${s.type[0].toUpperCase()}${s.type.slice(1)} slide`);

/**
 * Build a deck: choose sections (order matters), the reporting period and optional filters.
 * Sections hold no data; they render live when presented. Legacy slides (text/snapshot) in an
 * older deck are kept and can be reordered or removed.
 */
export default function PresentationEditor() {
	const { id } = useParams();
	const editing = Boolean(id);
	const navigate = useNavigate();
	const { user } = useAuth();
	const { notify } = useToast();
	const existing = useApiResource((signal) => presentationsService.get(id, { signal }), `pe|${id}`, { enabled: editing, isEmpty: () => false });

	const [title, setTitle] = useState('');
	const [status, setStatus] = useState('draft');
	const [team, setTeam] = useState('');
	const [project, setProject] = useState('');
	const [period, setPeriod] = useState({ preset: 'this_month' });
	const [slides, setSlides] = useState(() => (editing ? [] : REPORT_SECTIONS.slice(0, 3).map((s) => ({ type: 'section', section: s.key }))));
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState(null);
	const [fieldErrors, setFieldErrors] = useState({});

	useEffect(() => {
		const d = existing.data;
		if (!d || !d.config) return;
		setTitle(d.title);
		setStatus(d.status || 'draft');
		setTeam(d.team_id ? String(d.team_id) : '');
		setProject((d.config.filters && d.config.filters.projectId) || '');
		setPeriod(d.config.period || { preset: 'this_month' });
		setSlides(d.config.slides || []);
	}, [existing.data]);

	const included = new Set(slides.filter((s) => s.type === 'section').map((s) => s.section));
	const available = REPORT_SECTIONS.filter((s) => !included.has(s.key));
	const slideItems = slides.map((s, i) => ({ id: s.type === 'section' ? `section-${s.section}` : `${s.type}-${i}`, label: slideLabel(s), legacy: s.type !== 'section' }));

	const canSave = title.trim() && slides.length > 0 && isValidPeriod(period) && !saving;

	const save = async (e) => {
		e.preventDefault();
		setSaving(true);
		setError(null);
		setFieldErrors({});
		const body = { title: title.trim(), status, period, slides, filters: { project_id: project || null }, ...(user.role === 'admin' && team ? { team_id: team } : {}) };
		try {
			if (editing) await presentationsService.update(id, body);
			else await presentationsService.create(body);
			notify('Presentation saved');
			navigate(ROUTES.presentations);
		} catch (err) {
			setFieldErrors(err.fieldErrors || {});
			setError(err.message);
			setSaving(false);
		}
	};

	return (
		<>
			<PageHeader title={editing ? 'Edit presentation' : 'New presentation'} description="Choose what to show, for which period and scope" />
			<StateView res={editing ? existing : { status: 'success' }} loadingLines={5}>
				<form onSubmit={save} className="stack" noValidate>
					{error ? (
						<p role="alert" className="banner banner--error">
							{error}
						</p>
					) : null}
					<Card title="Details">
						<div className="form-grid">
							<Field label="Title" required error={fieldErrors.title}>
								{(p) => <input {...p} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />}
							</Field>
							<Field label="Status">
								{(p) => (
									<Select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
										<option value="draft">Draft</option>
										<option value="ready">Ready</option>
									</Select>
								)}
							</Field>
							<TeamFilter value={team} onChange={setTeam} />
							<ProjectFilter value={project} onChange={setProject} />
						</div>
						<div className="filter-bar" style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}>
							<DateRangeFilter label="Reporting period" value={period} onChange={setPeriod} />
						</div>
						<p className="small muted" style={{ marginTop: 8 }}>
							Presets are rolling: “This month” always means the month it is presented in. Managers present their own team; administrators can scope a deck to one team or all.
							{fieldErrors.period ? <span className="field-error"> {fieldErrors.period}</span> : null}
						</p>
					</Card>

					<Card title="Slides" subtitle="Presented in this order" actions={<span className="small muted">{slides.length} selected</span>}>
						{fieldErrors.slides ? (
							<p role="alert" className="field-error">
								{fieldErrors.slides}
							</p>
						) : null}
						{slides.length === 0 ? <p className="muted">Add at least one section below.</p> : null}
						<SortableList
							label="Slides"
							items={slideItems}
							onReorder={(ids) => setSlides((list) => ids.map((id) => list[slideItems.findIndex((it) => it.id === id)]))}
							renderItem={(it, { handle, index: i, isFirst, isLast, moveUp, moveDown }) => (
								<div className="insight" style={{ alignItems: 'center' }}>
									{handle}
									<span className="num muted" style={{ width: 20 }}>
										{i + 1}
									</span>
									<span style={{ flex: 1 }}>
										<strong>{it.label}</strong>
										{it.legacy ? <span className="small muted"> · legacy slide</span> : null}
									</span>
									<Button size="sm" variant="ghost" aria-label={`Move ${it.label} up`} disabled={isFirst} onClick={moveUp}>
										↑
									</Button>
									<Button size="sm" variant="ghost" aria-label={`Move ${it.label} down`} disabled={isLast} onClick={moveDown}>
										↓
									</Button>
									<Button size="sm" variant="ghost" icon="x" aria-label={`Remove ${it.label}`} onClick={() => setSlides((l) => l.filter((_, j) => j !== i))}>
										Remove
									</Button>
								</div>
							)}
						/>
						{available.length ? (
							<>
								<h3 className="small muted" style={{ margin: 'var(--space-4) 0 var(--space-2)' }}>
									Add a section
								</h3>
								<div className="legend" style={{ gap: 8 }}>
									{available.map((s) => (
										<Button key={s.key} size="sm" icon="plus" title={s.description} onClick={() => setSlides((l) => [...l, { type: 'section', section: s.key }])}>
											{s.label}
										</Button>
									))}
								</div>
							</>
						) : null}
					</Card>

					<div className="page-header__actions">
						<Button variant="primary" type="submit" loading={saving} disabled={!canSave}>
							Save presentation
						</Button>
						<Button onClick={() => navigate(ROUTES.presentations)} disabled={saving}>
							Cancel
						</Button>
					</div>
				</form>
			</StateView>
		</>
	);
}
