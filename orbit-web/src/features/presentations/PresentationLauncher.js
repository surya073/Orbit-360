import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import Button, { IconButton } from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import { Checkbox } from '../../components/forms/Choice';
import useApiResource from '../../hooks/useApiResource';
import { presentationsService } from '../../services/presentationsService';
import { detailOptions } from './deckSlides';
import { PRESENTATION_THEMES, readStoredOptions, readStoredTheme, storeOptions, storeTheme, storeTransition, themeById, themeStyle } from './presentationThemes';
import { DECK_TEMPLATES, LAYOUTS, layoutById, readStoredLayout, storeLayout } from './presentationTemplates';
import ThemePreview from './ThemePreview';
import Select from '../../components/forms/Select';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * "Choose your presentation experience": a full-viewport studio overlay. The user picks one of
 * five themes (live miniature previews painted with the real theme tokens), optionally the extra
 * people / project detail slides, then starts. Nothing plays until Start is pressed.
 * decks: [{ ROWID, title }]. onStart({ id, theme, people, records }).
 */
export default function PresentationLauncher({ decks, initialId, onClose, onStart }) {
	const uid = useId();
	const { can } = useAuth();
	const ref = useRef(null);
	const returnTo = useRef(document.activeElement);
	const [closing, setClosing] = useState(false);
	const [theme, setTheme] = useState(readStoredTheme);
	const [layout, setLayout] = useState(readStoredLayout);
	const [deckId, setDeckId] = useState(() => String(initialId || (decks[0] && decks[0].ROWID) || ''));
	const [opts, setOpts] = useState(readStoredOptions);
	const deck = decks.find((d) => String(d.ROWID) === String(deckId)) || decks[0];

	// Which optional detail slides this deck can offer comes from its saved sections.
	const detail = useApiResource((signal) => presentationsService.get(deckId, { signal }), `launch|${deckId}`, { enabled: Boolean(deckId), isEmpty: () => false });
	// ...and only the ones whose data this user may view (the backend refuses the requests otherwise).
	const offered = useMemo(() => {
		const o = detail.data && detail.data.config ? detailOptions(detail.data.config.slides) : { people: false, records: false, reporting: false };
		return { people: o.people && can('employees.view'), records: o.records && can('projects.view'), reporting: o.reporting && can('reporting.view') && can('employees.view') };
	}, [detail.data, can]);

	const close = useCallback(() => {
		const animate = window.matchMedia && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!animate) return onClose();
		setClosing(true);
		setTimeout(onClose, 180);
	}, [onClose]);

	useEffect(() => {
		const node = ref.current;
		const target = returnTo.current;
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		const first = node && node.querySelector('[data-autofocus]');
		if (first) first.focus();
		return () => {
			document.body.style.overflow = prevOverflow;
			if (target && target.focus) target.focus();
		};
	}, []);

	const onKeyDown = (e) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			close();
			return;
		}
		if (e.key !== 'Tab') return;
		const items = [...ref.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
		if (!items.length) return;
		const first = items[0];
		const last = items[items.length - 1];
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	};

	const pick = (id) => {
		setTheme(id);
		storeTheme(id); // remembered for next time, even if the launcher is closed without starting
	};

	const pickLayout = (id) => {
		setLayout(id);
		storeLayout(id);
	};
	// A template sets the colour theme, the layout and the slide transition together.
	const applyTemplate = (tpl) => {
		pick(tpl.theme);
		pickLayout(tpl.layout);
		storeTransition(tpl.transition);
	};

	const start = () => {
		storeTheme(theme);
		storeLayout(layout);
		storeOptions(opts);
		onStart({ id: deckId, theme, layout, people: offered.people && opts.people, records: offered.records && opts.records, reporting: offered.reporting && opts.reporting });
	};

	const t = themeById(theme);
	const titleId = `${uid}-title`;

	return createPortal(
		<div className={`pl ${closing ? 'is-closing' : ''}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} onKeyDown={onKeyDown} onMouseDown={(e) => e.target === e.currentTarget && close()}>
			<div className="pl__backdrop" aria-hidden="true" />
			<div className="pl__panel pscope" data-ptheme={t.id} style={themeStyle(t)}>
				<IconButton className="pl__close" icon="x" label="Close" onClick={close} />
				<header className="pl__head">
					<span className="pl__eyebrow">
						<Icon name="present" size={15} /> Presentation studio
					</span>
					<h2 id={titleId}>Choose Your Presentation Experience</h2>
					<p>Pick a look for “{deck ? deck.title : 'your presentation'}”. The same live data, shown in a theme made for the room.</p>
				</header>

				<div className="pl__body">
					<section className="pl__templates" aria-label="Templates">
						<h3 className="pl__sub">Templates</h3>
						<div className="pl__tpls">
							{DECK_TEMPLATES.map((tpl) => {
								const on = tpl.theme === theme && tpl.layout === layout;
								return (
									<button key={tpl.id} type="button" className={`ptpl ${on ? 'is-selected' : ''}`.trim()} aria-pressed={on} onClick={() => applyTemplate(tpl)}>
										<ThemePreview theme={tpl.theme} layout={tpl.layout} kind="content" className="ptpl__thumb" />
										<b>{tpl.name}</b>
										<small>{tpl.description}</small>
										<em>
											{layoutById(tpl.layout).label} layout · {themeById(tpl.theme).name}
										</em>
									</button>
								);
							})}
						</div>
					</section>

					<section className="pl__layouts" aria-label="Layout">
						<h3 className="pl__sub">Layout</h3>
						<div className="pl__layoutrow" role="radiogroup" aria-label="Slide layout">
							{LAYOUTS.map((l) => (
								<button key={l.id} type="button" role="radio" aria-checked={l.id === layout} className={`play ${l.id === layout ? 'is-selected' : ''}`.trim()} onClick={() => pickLayout(l.id)}>
									<span className="play__wire" data-wire={l.id} aria-hidden="true">
										<i />
										<i />
										<i />
									</span>
									<b>{l.label}</b>
									<small>{l.description}</small>
								</button>
							))}
						</div>
					</section>

					<h3 className="pl__sub">Colour theme</h3>
					<fieldset className="pl__themes">
						<legend className="sr-only">Presentation theme</legend>
						{PRESENTATION_THEMES.map((th, i) => (
							<label key={th.id} className={`pthemecard ${th.id === theme ? 'is-selected' : ''}`.trim()} style={{ '--i': i }}>
								<input type="radio" name={`${uid}-theme`} value={th.id} checked={th.id === theme} onChange={() => pick(th.id)} data-autofocus={th.id === theme ? true : undefined} />
								<ThemePreview theme={th} title={deck ? deck.title : undefined} />
								<span className="pthemecard__text">
									<b>{th.name}</b>
									<small>{th.tagline}</small>
								</span>
								<span className="pthemecard__swatches" aria-hidden="true">
									{th.swatches.map((c) => (
										<i key={c} style={{ background: c }} />
									))}
								</span>
								<span className="pthemecard__check" aria-hidden="true">
									<Icon name="check" size={14} />
								</span>
								{th.id === theme ? <span className="sr-only">Selected</span> : null}
							</label>
						))}
					</fieldset>

					<section className="pl__preview" aria-label={`${t.name} preview`} aria-live="polite">
						<div className="pl__previewgrid" key={t.id}>
							<ThemePreview theme={t} layout={layout} title={deck ? deck.title : undefined} kind="cover" />
							<ThemePreview theme={t} layout={layout} kind="content" />
						</div>
						<div className="pl__about">
							<h3>{t.name}</h3>
							<p>{t.description}</p>
							<div className="pl__options">
								{decks.length > 1 ? (
									<label className="pl__deck">
										<span>Presentation</span>
										<Select value={deckId} onChange={(e) => setDeckId(e.target.value)}>
											{decks.map((d) => (
												<option key={d.ROWID} value={d.ROWID}>
													{d.title}
												</option>
											))}
										</Select>
									</label>
								) : null}
								{offered.people ? <Checkbox label="Add team overview and individual profile slides" hint="Real employee records you are allowed to see" checked={opts.people} onChange={(e) => setOpts((o) => ({ ...o, people: e.target.checked }))} /> : null}
								{offered.reporting ? <Checkbox label="Add the team reporting tree slide" hint="The saved reporting structure of the team (left out if none is saved)" checked={opts.reporting} onChange={(e) => setOpts((o) => ({ ...o, reporting: e.target.checked }))} /> : null}
								{offered.records ? <Checkbox label="Add project record slides" hint="Detailed project records from the project data" checked={opts.records} onChange={(e) => setOpts((o) => ({ ...o, records: e.target.checked }))} /> : null}
							</div>
						</div>
					</section>
				</div>

				<footer className="pl__foot">
					<span className="pl__hint">Arrow keys or Space to move · Esc to exit · F for fullscreen</span>
					<Button variant="ghost" onClick={close}>
						Cancel
					</Button>
					<Button variant="primary" icon="play" onClick={start} disabled={!deck}>
						Start Presentation
					</Button>
				</footer>
			</div>
		</div>,
		document.body
	);
}
