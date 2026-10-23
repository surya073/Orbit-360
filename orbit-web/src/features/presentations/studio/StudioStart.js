import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AiButton from '../../../components/common/AiButton';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import { useToast } from '../../../components/feedback/ToastProvider';
import PageHeader from '../../../components/layout/PageHeader';
import { ROUTES } from '../../../config/routes';
import SlideCanvas from './SlideCanvas';
import { CANVAS_H, CANVAS_W } from './slideModel';
import { TEMPLATE_LIST, deckFromTemplate } from './templates';
import LookPicker from './LookPicker';
import { readStoredTheme, readStoredTransition, storeTheme, storeTransition } from '../presentationThemes';
import { importPptx } from './pptxImport';
import { listUserTemplates, removeUserTemplate, saveUserTemplate, slidesOfUserTemplate } from './userTemplates';

const K = 300 / CANVAS_W;

/** A design's cover, drawn for real and scaled down (so what you pick is what you get). */
function Cover({ id, slide: given }) {
	const slide = useMemo(() => given || deckFromTemplate(id)[0], [id, given]);
	return (
		<div className="start-cover" style={{ width: CANVAS_W * K, height: CANVAS_H * K }}>
			<div className="start-cover__scaled" style={{ transform: `scale(${K})` }}>
				<SlideCanvas slide={slide} animate={false} editing />
			</div>
		</div>
	);
}

/** What was taken from a PowerPoint file, in plain words, with warnings for anything that did not come across. */
function ImportSummary({ summary, onClose, onOpen }) {
	const { report: r, slides } = summary;
	const layouts = Object.entries(r.layouts);
	const warnings = [
		r.pictures ? `${r.pictures} picture${r.pictures === 1 ? ' is' : 's are'} too detailed to keep inside a slide. Their boxes are in place, ready for a picture link.` : '',
		r.skipped ? `${r.skipped} table, chart or diagram object${r.skipped === 1 ? '' : 's'} could not be imported (only text, shapes and pictures are).` : '',
		r.truncated ? `${r.truncated} object${r.truncated === 1 ? ' was' : 's were'} left out: a slide holds at most 40.` : '',
	].filter(Boolean);
	return (
		<Modal
			title="Imported from PowerPoint"
			size="lg"
			onClose={onClose}
			footer={
				<>
					<Button onClick={onClose}>Close</Button>
					<Button variant="primary" onClick={onOpen}>
						Open in the editor
					</Button>
				</>
			}
		>
			<div className="stack">
				<p>
					<b>{summary.fileName}</b>: {slides.length} slide{slides.length === 1 ? '' : 's'} are ready to edit.{summary.kept ? ' It is also kept under Your templates (on this device) to start future decks from.' : ' It could not be kept as a template on this device.'}
				</p>
				<dl className="import-found">
					<div>
						<dt>Theme colours</dt>
						<dd>
							{r.palette.length ? (
								<span className="import-found__colors">
									{r.palette.map((c) => (
										<i key={c} style={{ background: c }} title={c} />
									))}
									<small>offered in every colour picker of this deck</small>
								</span>
							) : (
								'None found'
							)}
						</dd>
					</div>
					<div>
						<dt>Fonts</dt>
						<dd>{[r.fonts.heading, r.fonts.body].filter(Boolean).join(' / ') || 'Not specified'}</dd>
					</div>
					<div>
						<dt>Animations</dt>
						<dd>{r.animations ? `${r.animations} entrance effect${r.animations === 1 ? '' : 's'}${r.clicks ? `, up to ${r.clicks} click step${r.clicks === 1 ? '' : 's'} per slide` : ''}` : 'None found'}</dd>
					</div>
					<div>
						<dt>Layouts</dt>
						<dd>{layouts.length ? layouts.map(([n, c]) => `${n} (${c})`).join(', ') : 'Not named in the file'}</dd>
					</div>
				</dl>
				{warnings.map((w) => (
					<p key={w} role="alert" className="banner banner--warning">
						{w}
					</p>
				))}
				<p className="small muted">The separation above is done with built-in rules on your computer; nothing was uploaded.</p>
				<AiButton feature="Tidy the imported layout and rewrite the text">Improve with AI</AiButton>
			</div>
		</Modal>
	);
}

/**
 * Where a new presentation begins: a design (a complete little deck you then make your own), a blank slide, a PowerPoint
 * file to turn into a template, or the quick report deck (live sections only). Nothing is saved until you press Save.
 */
export default function StudioStart() {
	const navigate = useNavigate();
	const { notify } = useToast();
	const fileRef = useRef(null);
	const [busy, setBusy] = useState(false);
	const [mine, setMine] = useState(listUserTemplates);
	const [look, setLook] = useState(() => ({ theme: readStoredTheme(), transition: readStoredTransition() }));
	const [summary, setSummary] = useState(null); // what was found in an imported PowerPoint, shown before the editor opens
	const pickTheme = (id) => {
		storeTheme(id);
		setLook((l) => ({ ...l, theme: id }));
	};
	const pickTransition = (id) => {
		storeTransition(id);
		setLook((l) => ({ ...l, transition: id }));
	};
	const go = (tpl) => navigate(`${ROUTES.presentationStudio}?tpl=${tpl}`);

	const onFile = async (e) => {
		const file = e.target.files && e.target.files[0];
		e.target.value = '';
		if (!file) return;
		setBusy(true);
		try {
			const out = await importPptx(file);
			const kept = saveUserTemplate(out.title, out.slides, { palette: out.report.palette, fonts: out.report.fonts, animations: out.report.animations }); // so the file's design can start the next deck too
			setMine(listUserTemplates());
			setSummary({ ...out, kept: Boolean(kept), fileName: file.name });
			setBusy(false);
		} catch (err) {
			notify(err.message || 'That file could not be imported.', 'error');
			setBusy(false);
		}
	};

	return (
		<div className="start">
			<PageHeader title="New presentation" description="Pick a design to start from. Everything on it can be edited, moved or replaced, and you can add live data anywhere." />
			<section aria-label="Theme and animation" className="start__look">
				<h2 className="start__h">Theme and animation</h2>
				<p className="small muted">Applies to every slide of the new presentation (you can change it per slide, or for all slides, in the editor).</p>
				<LookPicker theme={look.theme} transition={look.transition} onTheme={pickTheme} onTransition={pickTransition} />
			</section>
			<section aria-label="Designs">
				<h2 className="start__h">Designs</h2>
				<div className="start__grid" role="list">
					{TEMPLATE_LIST.map((t) => (
						<button key={t.id} type="button" role="listitem" className="start__card" onClick={() => go(t.id)}>
							<Cover id={t.id} />
							<span className="start__meta">
								<b>{t.name}</b>
								<small>{t.description}</small>
							</span>
						</button>
					))}
				</div>
			</section>
			{mine.length ? (
				<section aria-label="Your templates">
					<h2 className="start__h">Your templates</h2>
					<div className="start__grid" role="list">
						{mine.map((t) => (
							<div key={t.id} role="listitem" className="start__card start__card--mine">
								<button type="button" className="start__open" onClick={() => { const c = slidesOfUserTemplate(t.id); if (c) navigate(ROUTES.presentationStudio, { state: c }); }}>
									<Cover slide={t.slides[0]} />
									<span className="start__meta">
										<b>{t.name}</b>
										<small>{t.slides.length} slide{t.slides.length === 1 ? '' : 's'} · saved on this device</small>
									</span>
								</button>
								<Button size="sm" variant="ghost" icon="trash" aria-label={`Remove template ${t.name}`} onClick={() => { removeUserTemplate(t.id); setMine(listUserTemplates()); }}>
									Remove
								</Button>
							</div>
						))}
					</div>
				</section>
			) : null}
			<section aria-label="Other ways to start" className="start__other">
				<button type="button" className="start__tile" onClick={() => go('blank')}>
					<Icon name="plus" size={22} />
					<span>
						<b>Blank presentation</b>
						<small>One empty slide: add text, shapes, pictures and live data</small>
					</span>
				</button>
				<button type="button" className="start__tile" onClick={() => fileRef.current && fileRef.current.click()} disabled={busy}>
					<Icon name="upload" size={22} />
					<span>
						<b>{busy ? 'Reading the file…' : 'Use a PowerPoint file'}</b>
						<small>Upload a .pptx: its text, pictures, shapes and colours become editable slides</small>
					</span>
				</button>
				<input ref={fileRef} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" className="sr-only" aria-label="PowerPoint file" onChange={onFile} />
				<button type="button" className="start__tile" onClick={() => navigate(ROUTES.presentationQuick)}>
					<Icon name="dashboard" size={22} />
					<span>
						<b>Quick report deck</b>
						<small>Just pick report sections; the player draws them from live data</small>
					</span>
				</button>
			</section>
			{summary ? <ImportSummary summary={summary} onClose={() => setSummary(null)} onOpen={() => navigate(ROUTES.presentationStudio, { state: { slides: summary.slides, title: summary.title, palette: summary.report.palette } })} /> : null}
			<p className="small muted">
				<Button size="sm" variant="ghost" onClick={() => navigate(ROUTES.presentations)}>
					Back to presentations
				</Button>
			</p>
		</div>
	);
}
