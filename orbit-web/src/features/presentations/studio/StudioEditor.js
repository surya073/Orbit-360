import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import Button from '../../../components/common/Button';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Icon from '../../../components/common/Icon';
import Popover from '../../../components/common/Popover';
import StateView from '../../../components/feedback/StateView';
import { useToast } from '../../../components/feedback/ToastProvider';
import DateRangeFilter, { isValidPeriod } from '../../../components/filters/DateRangeFilter';
import ProjectFilter from '../../../components/filters/ProjectFilter';
import TeamFilter from '../../../components/filters/TeamFilter';
import Select from '../../../components/forms/Select';
import { REPORT_SECTIONS } from '../../../config/constants';
import { ROUTES } from '../../../config/routes';
import useApiResource from '../../../hooks/useApiResource';
import useUnsavedGuard from '../../../hooks/useUnsavedGuard';
import { presentationsService } from '../../../services/presentationsService';
import { readStoredTheme, readStoredTransition, themeById, themeStyle } from '../presentationThemes';
import { ObjectPanel, PaletteContext, SlidePanel } from './Inspector';
import SlideCanvas from './SlideCanvas';
import Stage from './Stage';
import { BLANK_DECK, deckFromTemplate } from './templates';
import useDeckHistory from './useDeckHistory';
import { saveUserTemplate } from './userTemplates';
import useWidgetData from './useWidgetData';
import WidgetView from './WidgetView';
import { CANVAS_H, CANVAS_W, MAX_OBJECTS, WIDGET_TYPES, cloneObject, colorCss, cloneSlide, makeButton, makeImage, makeShape, makeSlide, makeText, makeWidget, slideTitle } from './slideModel';

const LABEL = Object.fromEntries(REPORT_SECTIONS.map((s) => [s.key, s.label]));

/** A slide's thumbnail: the real canvas, scaled down, without animation. */
function Thumb({ slide, theme }) {
	const k = 168 / CANVAS_W;
	return (
		<div className="rail-thumb pscope" style={{ width: CANVAS_W * k, height: CANVAS_H * k, ...theme.style }} data-ptheme={theme.id} data-pscheme={theme.dark ? 'dark' : 'light'}>
			{slide.type === 'custom' ? (
				<div className="rail-thumb__scaled" style={{ transform: `scale(${k})` }}>
					<SlideCanvas slide={slide} animate={false} editing renderWidget={(o) => <div style={{ width: '100%', height: '100%', borderRadius: (o.st && o.st.r) ?? 28, background: colorCss(o.st && o.st.fill, 'color-mix(in srgb, currentColor 10%, transparent)') }} />} />
				</div>
			) : (
				<div className="rail-thumb__live">
					<Icon name="dashboard" size={16} />
					<span>{LABEL[slide.section] || slide.title || 'Live slide'}</span>
				</div>
			)}
		</div>
	);
}

/**
 * The presentation studio: slides on the left, the slide in the middle, properties on the right. New decks start from a
 * design (?tpl=) or an imported file; saved decks open by id. Slides are free-form (text, shapes, pictures, buttons,
 * live-data widgets) or live report sections. Everything is edited locally and saved with one button.
 */
export default function StudioEditor() {
	const { id } = useParams();
	const editing = Boolean(id);
	const navigate = useNavigate();
	const location = useLocation();
	const [sp] = useSearchParams();
	const { user } = useAuth();
	const { notify } = useToast();
	const existing = useApiResource((signal) => presentationsService.get(id, { signal }), `studio|${id}`, { enabled: editing, isEmpty: () => false });

	const initialSlides = useMemo(() => {
		if (editing) return [];
		// the look picked on the start page (stored per device) is stamped on every new slide, so it travels with the deck
		const look = { theme: readStoredTheme(), transition: readStoredTransition() };
		const stamp = (list) => list.map((s) => (s.type === 'custom' ? { ...look, ...s } : s));
		const imported = location.state && location.state.slides;
		if (Array.isArray(imported) && imported.length) return stamp(imported);
		const tpl = sp.get('tpl');
		return stamp(tpl === 'blank' || !tpl ? BLANK_DECK() : deckFromTemplate(tpl));
	}, []); // eslint-disable-line react-hooks/exhaustive-deps
	const hist = useDeckHistory(initialSlides);
	const { slides, commit } = hist;

	const [title, setTitle] = useState(() => (location.state && location.state.title) || (editing ? '' : sp.get('tpl') && sp.get('tpl') !== 'blank' ? 'Quarterly review' : 'New presentation'));
	const [status, setStatus] = useState('draft');
	const [team, setTeam] = useState('');
	const [project, setProject] = useState('');
	const [period, setPeriod] = useState({ preset: 'this_month' });
	const [savedId, setSavedId] = useState(id || null);
	const [saving, setSaving] = useState(false);
	const [lastSaved, setLastSaved] = useState(0); // history.changes at the last save
	const [slideIdx, setSlideIdx] = useState(0);
	const [selId, setSelId] = useState(null);
	const [editingId, setEditingId] = useState(null);
	const [tab, setTab] = useState('object');
	const [leaving, setLeaving] = useState(false); // asks before leaving with unsaved changes
	const clip = useRef(null);
	const palette = (location.state && location.state.palette) || []; // colours that came with an imported or saved template

	useEffect(() => {
		const d = existing.data;
		if (!d || !d.config) return;
		setTitle(d.title);
		setStatus(d.status || 'draft');
		setTeam(d.team_id ? String(d.team_id) : '');
		setProject((d.config.filters && d.config.filters.projectId) || '');
		setPeriod(d.config.period || { preset: 'this_month' });
		hist.reset(d.config.slides || []);
		setLastSaved(0);
		setSlideIdx(0);
	}, [existing.data]); // eslint-disable-line react-hooks/exhaustive-deps

	const dirty = hist.changes !== lastSaved;
	useUnsavedGuard(dirty);

	const idx = Math.min(slideIdx, Math.max(slides.length - 1, 0));
	const slide = slides[idx];
	const custom = slide && slide.type === 'custom' ? slide : null;
	const obj = custom ? custom.objects.find((o) => o.id === selId) || null : null;
	const themeOf = (s) => {
		const t = themeById((s && s.theme) || readStoredTheme());
		return { id: t.id, dark: t.dark, style: themeStyle(t) };
	};
	const theme = useMemo(() => themeOf(custom), [custom && custom.theme]); // eslint-disable-line react-hooks/exhaustive-deps

	// ---- edits ------------------------------------------------------------------------------------------
	const setSlide = useCallback((n, next, key) => commit(slides.map((s, i) => (i === n ? next : s)), key), [slides, commit]);
	const patchSlide = (patch, key) => custom && setSlide(idx, { ...custom, ...patch }, key);
	const patchObject = useCallback(
		(oid, patch, key) => {
			if (!custom) return;
			setSlide(idx, { ...custom, objects: custom.objects.map((o) => (o.id === oid ? { ...o, ...patch } : o)) }, key);
		},
		[custom, idx, setSlide]
	);
	const patchStyle = (patch, key) => obj && patchObject(obj.id, { st: { ...obj.st, ...patch } }, key);
	const addObject = (o) => {
		if (!custom) return;
		if (custom.objects.length >= MAX_OBJECTS) return notify(`A slide holds at most ${MAX_OBJECTS} objects.`, 'warning');
		// a new object lands in the middle of the slide, each one a little lower and further along than the last (never exactly on top of another)
		const step = (custom.objects.length % 8) * 36;
		const placed = { ...o, x: Math.round((CANVAS_W - o.w) / 2) + step - 140, y: Math.round((CANVAS_H - o.h) / 2) + step - 140 };
		setSlide(idx, { ...custom, objects: [...custom.objects, placed] });
		setSelId(o.id);
		setTab('object');
		if (o.kind === 'text') setEditingId(o.id);
	};
	const deleteObject = useCallback(() => {
		if (!custom || !selId) return;
		setSlide(idx, { ...custom, objects: custom.objects.filter((o) => o.id !== selId) });
		setSelId(null);
		setEditingId(null);
	}, [custom, selId, idx, setSlide]);
	const duplicateObject = useCallback(() => {
		if (!custom || !obj || custom.objects.length >= MAX_OBJECTS) return;
		const copy = cloneObject(obj);
		setSlide(idx, { ...custom, objects: [...custom.objects, copy] });
		setSelId(copy.id);
	}, [custom, obj, idx, setSlide]);
	const reorder = (toFront) => {
		if (!custom || !obj) return;
		const rest = custom.objects.filter((o) => o.id !== obj.id);
		setSlide(idx, { ...custom, objects: toFront ? [...rest, obj] : [obj, ...rest] });
	};
	const nudge = useCallback(
		(dx, dy) => {
			if (obj) patchObject(obj.id, { x: obj.x + dx, y: obj.y + dy }, `nudge-${obj.id}`);
		},
		[obj, patchObject]
	);

	const addSlide = (after = idx) => {
		const s = makeSlide({ name: '', bg: custom ? { ...custom.bg } : { kind: 'theme' }, ...(custom ? { theme: custom.theme, transition: custom.transition } : {}) });
		commit([...slides.slice(0, after + 1), s, ...slides.slice(after + 1)]);
		setSlideIdx(after + 1);
		setSelId(null);
	};
	const addSection = (key) => {
		commit([...slides.slice(0, idx + 1), { type: 'section', section: key }, ...slides.slice(idx + 1)]);
		setSlideIdx(idx + 1);
		setSelId(null);
	};
	const removeSlide = (n) => {
		if (slides.length <= 1) return notify('A presentation needs at least one slide.', 'warning');
		commit(slides.filter((_, i) => i !== n));
		setSlideIdx(Math.max(0, n - (n >= slides.length - 1 ? 1 : 0)));
		setSelId(null);
	};
	const duplicateSlide = (n) => {
		const s = slides[n];
		const copy = s.type === 'custom' ? cloneSlide(s) : { ...s };
		commit([...slides.slice(0, n + 1), copy, ...slides.slice(n + 1)]);
		setSlideIdx(n + 1);
	};
	const moveSlide = (n, d) => {
		const to = n + d;
		if (to < 0 || to >= slides.length) return;
		const next = [...slides];
		[next[n], next[to]] = [next[to], next[n]];
		commit(next);
		setSlideIdx(to);
	};

	// ---- keyboard (only when the focus is not in a field) ---------------------------------------------------
	const live = useRef({});
	live.current = { save: () => save(), cycle: (back) => { const list = custom ? custom.objects : []; if (!list.length) return; const i = list.findIndex((o) => o.id === selId); setSelId(list[(i + (back ? -1 : 1) + list.length) % list.length].id); }, deleteObject, duplicateObject, nudge, hist, obj, custom, addObject, setSelId, setEditingId, notify };
	useEffect(() => {
		const onKey = (e) => {
			const t = e.target;
			if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
			const L = live.current;
			const mod = e.ctrlKey || e.metaKey;
			const k = e.key.toLowerCase();
			if (mod && k === 's') {
				e.preventDefault();
				L.save();
			} else if (k === 'tab' && L.custom && L.custom.objects.length && t && t.closest && t.closest('.stage__layer')) {
				e.preventDefault();
				L.cycle(e.shiftKey);
			} else if (mod && k === 'z') {
				e.preventDefault();
				if (e.shiftKey) L.hist.redo();
				else L.hist.undo();
			} else if (mod && k === 'y') {
				e.preventDefault();
				L.hist.redo();
			} else if (mod && k === 'd' && L.obj) {
				e.preventDefault();
				L.duplicateObject();
			} else if (mod && k === 'c' && L.obj) {
				clip.current = L.obj;
			} else if (mod && k === 'v' && clip.current && L.custom) {
				e.preventDefault();
				L.addObject(cloneObject(clip.current));
			} else if ((k === 'delete' || k === 'backspace') && L.obj) {
				e.preventDefault();
				L.deleteObject();
			} else if (k === 'escape') {
				L.setSelId(null);
				L.setEditingId(null);
			} else if (k === 'enter' && L.obj && (L.obj.kind === 'text' || L.obj.kind === 'button')) {
				e.preventDefault();
				L.setEditingId(L.obj.id);
			} else if (L.obj && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) {
				e.preventDefault();
				const step = e.shiftKey ? 10 : 1;
				L.nudge(k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0, k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	// ---- save --------------------------------------------------------------------------------------------
	const canSave = title.trim() && slides.length > 0 && isValidPeriod(period) && !saving;
	const save = async ({ quiet = false } = {}) => {
		if (!canSave) return null;
		setSaving(true);
		const body = { title: title.trim(), status, period, slides, filters: { project_id: project || null }, ...(user.role === 'admin' && team ? { team_id: team } : {}) };
		try {
			let rowId = savedId;
			if (savedId) await presentationsService.update(savedId, body);
			else {
				const r = await presentationsService.create(body);
				rowId = String(r.data.ROWID);
				setSavedId(rowId);
				navigate(ROUTES.presentationEdit(rowId), { replace: true });
			}
			setLastSaved(hist.changes);
			if (!quiet) notify('Presentation saved');
			setSaving(false);
			return rowId;
		} catch (err) {
			notify(err.fieldErrors && err.fieldErrors.slides ? err.fieldErrors.slides : err.message, 'error');
			setSaving(false);
			return null;
		}
	};
	const preview = async () => {
		const rowId = dirty || !savedId ? await save({ quiet: true }) : savedId;
		if (rowId) window.open(`${window.location.pathname}#${ROUTES.present(rowId)}`, '_blank', 'noopener');
	};

	// Widgets show the real figures for the deck's period while editing (only the datasets they use are fetched).
	const widgets = useWidgetData(slides, { period, team, project, enabled: Boolean(custom) });
	const renderWidget = useCallback((o) => <WidgetView o={o} data={widgets.data} prev={widgets.prev} />, [widgets.data, widgets.prev]);
	const noSlides = slides.length === 0;

	return (
		<div className="studio">
			<StateView res={editing ? existing : { status: 'success' }} loadingLines={6}>
				<header className="studio__bar">
<Button size="sm" variant="ghost" icon="chevronLeft" onClick={() => (dirty ? setLeaving(true) : navigate(ROUTES.presentations))}>
						Presentations
					</Button>
					<input className="studio__title" aria-label="Presentation title" placeholder="Untitled presentation" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
					<span className="studio__spacer" />
					<div className="studio__tools" role="toolbar" aria-label="Add to the slide">
						<Button size="sm" icon="edit" disabled={!custom} onClick={() => addObject(makeText())} title="Add text">
							Text
						</Button>
						<Popover
							label="Add a shape"
							trigger={({ toggle, props }) => (
								<Button size="sm" icon="dashboard" disabled={!custom} onClick={toggle} {...props}>
									Shape
								</Button>
							)}
						>
							{({ close }) => (
								<div className="studio__menu">
									{[['rect', 'Rectangle'], ['pill', 'Rounded bar'], ['ellipse', 'Circle'], ['triangle', 'Triangle'], ['line', 'Line']].map(([shape, label]) => (
										<button
											key={shape}
											type="button"
											className="menu-item"
											onClick={() => {
												addObject(shape === 'line' ? makeShape({ shape, w: 600, h: 6 }) : makeShape({ shape, ...(shape === 'pill' ? { w: 520, h: 120 } : {}) }));
												close();
											}}
										>
											{label}
										</button>
									))}
								</div>
							)}
						</Popover>
						<Button size="sm" icon="upload" disabled={!custom} onClick={() => addObject(makeImage())} title="Add a picture (link or small upload)">
							Picture
						</Button>
						<Button size="sm" icon="external" disabled={!custom} onClick={() => addObject(makeButton())} title="Add a link button">
							Button
						</Button>
						<Popover
							label="Add live data"
							trigger={({ toggle, props }) => (
								<Button size="sm" icon="trend" disabled={!custom} onClick={toggle} {...props}>
									Live data
								</Button>
							)}
						>
							{({ close }) => (
								<div className="studio__menu">
									{WIDGET_TYPES.map((w) => (
										<button
											key={w.id}
											type="button"
											className="menu-item studio__menu-item"
											onClick={() => {
												addObject(makeWidget(w.id));
												close();
											}}
										>
											<b>{w.label}</b>
											<small>{w.hint}</small>
										</button>
									))}
								</div>
							)}
						</Popover>
					</div>
					<span className="studio__spacer" />
					<Button size="sm" variant="ghost" icon="undo" onClick={hist.undo} disabled={!hist.canUndo} aria-label="Undo" title="Undo (Ctrl+Z)" />
					<Button size="sm" variant="ghost" icon="redo" onClick={hist.redo} disabled={!hist.canRedo} aria-label="Redo" title="Redo (Ctrl+Y)" />
					<Button size="sm" icon="play" onClick={preview} disabled={!canSave && !savedId}>
						Present
					</Button>
					<Button size="sm" variant="primary" onClick={() => save()} loading={saving} disabled={!canSave || (!dirty && Boolean(savedId))}>
						{dirty || !savedId ? 'Save' : 'Saved'}
					</Button>
				</header>

				<div className="studio__body">
					<nav className="studio__rail" aria-label="Slides">
						<ol>
							{slides.map((s, i) => (
								<li key={s.id || `${s.section}-${i}`} className={i === idx ? 'is-current' : ''}>
									<button type="button" className="studio__slide" onClick={() => { setSlideIdx(i); setSelId(null); setEditingId(null); }} aria-current={i === idx ? 'true' : undefined} aria-label={`Slide ${i + 1}: ${s.type === 'custom' ? slideTitle(s, i) : LABEL[s.section] || 'Live slide'}`}>
										<span className="studio__num">{i + 1}</span>
										<Thumb slide={s} theme={s.type === 'custom' ? themeOf(s) : theme} />
									</button>
									{i === idx ? (
										<span className="studio__slide-tools">
											<button type="button" aria-label="Move slide up" disabled={i === 0} onClick={() => moveSlide(i, -1)}>↑</button>
											<button type="button" aria-label="Move slide down" disabled={i === slides.length - 1} onClick={() => moveSlide(i, 1)}>↓</button>
											<button type="button" aria-label="Duplicate slide" onClick={() => duplicateSlide(i)}>⧉</button>
											<button type="button" aria-label="Delete slide" onClick={() => removeSlide(i)}>✕</button>
										</span>
									) : null}
								</li>
							))}
						</ol>
						<div className="studio__rail-add">
							<Button size="sm" icon="plus" onClick={() => addSlide()}>
								New slide
							</Button>
							<Popover
								label="Add a live report slide"
								trigger={({ toggle, props }) => (
									<Button size="sm" variant="ghost" onClick={toggle} {...props}>
										Report slide…
									</Button>
								)}
							>
								{({ close }) => (
									<div className="studio__menu">
										{REPORT_SECTIONS.map((s) => (
											<button key={s.key} type="button" className="menu-item studio__menu-item" onClick={() => { addSection(s.key); close(); }}>
												<b>{s.label}</b>
												<small>{s.description}</small>
											</button>
										))}
									</div>
								)}
							</Popover>
						</div>
					</nav>

					<main className="studio__stage">
						{noSlides ? (
							<p className="muted">No slides yet.</p>
						) : custom ? (
							<Stage slide={custom} theme={theme} selectedId={selId} onSelect={(oid) => { setSelId(oid); if (oid) setTab('object'); }} onChangeObject={patchObject} editingId={editingId} setEditingId={setEditingId} renderWidget={renderWidget} />
						) : (
							<div className="studio__live">
								<Icon name="dashboard" size={40} />
								<h2>{LABEL[slide.section] || 'Live report slide'}</h2>
								<p>This slide shows live data for the deck's period when you present. It is drawn by the player, so it is not edited here.</p>
								<Button variant="danger" size="sm" icon="trash" onClick={() => removeSlide(idx)}>
									Remove this slide
								</Button>
							</div>
						)}
					</main>

					<PaletteContext.Provider value={palette}>
					<aside className="studio__panel" aria-label="Properties">
						<div className="studio__tabs" role="tablist" aria-label="Properties">
							{[['object', 'Selected'], ['slide', 'Slide'], ['deck', 'Deck']].map(([k, label]) => (
								<button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
									{label}
								</button>
							))}
						</div>
						<div className="studio__panel-body" role="tabpanel">
							{tab === 'object' ? (
								obj ? (
									<ObjectPanel o={obj} slideCount={slides.length} onPatch={(patch, key) => patchObject(obj.id, patch, key)} onStyle={patchStyle} onDuplicate={duplicateObject} onDelete={deleteObject} onFront={() => reorder(true)} onBack={() => reorder(false)} notify={notify} />
								) : (
									<p className="studio__empty">Click something on the slide to change it, or add text, a shape, a picture or live data from the bar above.</p>
								)
							) : null}
							{tab === 'slide' ? (
								custom ? (
									<SlidePanel slide={custom} theme={theme.id} transition={custom.transition || readStoredTransition()} onPatch={patchSlide} onApplyLook={() => commit(slides.map((s) => (s.type === 'custom' ? { ...s, theme: theme.id, transition: custom.transition || readStoredTransition() } : s)))} onAnimateAll={() => patchSlide({ objects: custom.objects.map((o, n) => ({ ...o, anim: { in: 'rise', delay: n * 150, dur: 600, step: 0 } })) })} onApplyAll={() => commit(slides.map((s) => (s.type === 'custom' ? { ...s, bg: { ...custom.bg } } : s)))} />
								) : (
									<p className="studio__empty">Live report slides follow the theme chosen when presenting.</p>
								)
							) : null}
							{tab === 'deck' ? (
								<div className="insp">
									<section className="insp__sec">
										<h3>Presentation</h3>
										<label className="insp__row">
											<span className="insp__label">Status</span>
											<Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
												<option value="draft">Draft</option>
												<option value="ready">Ready</option>
											</Select>
										</label>
										<TeamFilter value={team} onChange={setTeam} />
										<ProjectFilter value={project} onChange={setProject} />
										<DateRangeFilter label="Reporting period" value={period} onChange={setPeriod} />
										<small className="insp__hint">Live data on the slides uses this period. “This month” always means the month it is presented in.</small>
										<Button
											size="sm"
											onClick={() => {
												const t = saveUserTemplate(title.trim() || 'My template', slides);
												notify(t ? 'Saved under Your templates (this device) on the New presentation page.' : 'This deck could not be kept as a template (it has no editable slides, or it is too large for this device).', t ? 'success' : 'warning');
											}}
										>
											Save as a template
										</Button>
									</section>
								</div>
							) : null}
						</div>
					</aside>
					</PaletteContext.Provider>
				</div>
			</StateView>
			{leaving ? (
				<ConfirmDialog
					title="Leave without saving?"
					message="This presentation has changes that are not saved. If you leave now they are lost."
					confirmLabel="Leave"
					onCancel={() => setLeaving(false)}
					onConfirm={() => navigate(ROUTES.presentations)}
				/>
			) : null}
		</div>
	);
}

