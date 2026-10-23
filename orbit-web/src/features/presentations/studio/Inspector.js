import React, { createContext, useContext, useRef, useState } from 'react';
import AiButton from '../../../components/common/AiButton';
import Button from '../../../components/common/Button';
import Select from '../../../components/forms/Select';
import { ANIMATIONS, FONT_STACKS, HOVERS, SHAPES, THEME_COLORS, WIDGET_TYPES, colorCss, metricsFor, defaultMetric } from './slideModel';
import { shrinkImage } from './images';
import LookPicker from './LookPicker';

/** The right-hand panels of the studio: what is selected (object), the slide, and the deck. Every control applies at once. */

const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

function Row({ label, children, hint }) {
	return (
		<div className="insp__row">
			<span className="insp__label">{label}</span>
			<div className="insp__ctl">{children}</div>
			{hint ? <small className="insp__hint">{hint}</small> : null}
		</div>
	);
}

/** A number field that can be emptied and retyped: the text is its own while typing, and snaps back to the value when you leave. */
function Num({ value, onChange, min = -9999, max = 9999, step = 1, label, suffix }) {
	const [txt, setTxt] = useState(null);
	const shown = txt !== null ? txt : Number.isFinite(value) ? String(value) : '';
	return (
		<span className="insp__num">
			<input
				type="number"
				aria-label={label}
				value={shown}
				min={min}
				max={max}
				step={step}
				onChange={(e) => {
					setTxt(e.target.value);
					const n = Number(e.target.value);
					if (e.target.value !== '' && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
				}}
				onBlur={() => setTxt(null)}
			/>
			{suffix ? <i>{suffix}</i> : null}
		</span>
	);
}

function Seg({ label, value, options, onChange }) {
	return (
		<div className="insp__seg" role="radiogroup" aria-label={label}>
			{options.map((o) => (
				<button key={o.id} type="button" role="radio" aria-checked={value === o.id} title={o.title || o.label} onClick={() => onChange(o.id)}>
					{o.label}
				</button>
			))}
		</div>
	);
}

/** Theme swatches plus a custom colour. `allowNone` adds a "no colour" choice. */
/** Colours that came with the deck's template (an imported PowerPoint's theme); every colour picker offers them first. */
export const PaletteContext = createContext([]);

export function ColorField({ label, value, onChange, allowNone = false }) {
	const custom = isHex(value) ? value : '#888888';
	const fromTemplate = useContext(PaletteContext);
	return (
		<div className="insp__colors" role="radiogroup" aria-label={label}>
			{allowNone ? (
				<button type="button" role="radio" aria-checked={!value || value === 'transparent'} className="insp__swatch insp__swatch--none" title="None" onClick={() => onChange('transparent')}>
					<span className="sr-only">None</span>
				</button>
			) : null}
			{fromTemplate.map((c) => (
				<button key={c} type="button" role="radio" aria-checked={value === c} className="insp__swatch insp__swatch--tpl" style={{ background: c }} title={`From the template: ${c}`} onClick={() => onChange(c)}>
					<span className="sr-only">{`Template colour ${c}`}</span>
				</button>
			))}
			{THEME_COLORS.map((c) => (
				<button key={c.id} type="button" role="radio" aria-checked={value === c.id} className="insp__swatch" style={{ background: c.css }} title={c.label} onClick={() => onChange(c.id)}>
					<span className="sr-only">{c.label}</span>
				</button>
			))}
			<label className={`insp__swatch insp__swatch--custom ${isHex(value) ? 'is-on' : ''}`} title="Any colour" style={isHex(value) ? { background: value } : undefined}>
				<input type="color" aria-label={`${label}: custom colour`} value={custom} onChange={(e) => onChange(e.target.value)} />
			</label>
		</div>
	);
}

function Section({ title, children }) {
	return (
		<section className="insp__sec">
			<h3>{title}</h3>
			{children}
		</section>
	);
}

// ---- object ---------------------------------------------------------------------------------------------

export function ObjectPanel({ o, slideCount, onPatch, onStyle, onDuplicate, onDelete, onFront, onBack, notify }) {
	const fileRef = useRef(null);
	const [busy, setBusy] = useState(false);
	const st = o.st || {};
	const set = (patch) => onPatch(patch, `p-${o.id}`);
	const sty = (patch) => onStyle(patch, `s-${o.id}`);
	const textual = o.kind === 'text' || o.kind === 'button';
	const anim = o.anim || { in: 'none', delay: 0, dur: 600, step: 0 };

	const upload = async (e) => {
		const file = e.target.files && e.target.files[0];
		e.target.value = '';
		if (!file) return;
		setBusy(true);
		try {
			set({ src: await shrinkImage(file), alt: o.alt || file.name.replace(/\.[^.]+$/, '') });
		} catch (err) {
			notify(err.message, 'error');
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="insp">
			<div className="insp__actions">
				<Button size="sm" icon="copy" onClick={onDuplicate} title="Duplicate (Ctrl+D)">
					Duplicate
				</Button>
				<Button size="sm" onClick={onFront} title="Bring to front">
					Front
				</Button>
				<Button size="sm" onClick={onBack} title="Send to back">
					Back
				</Button>
				<Button size="sm" variant="danger" icon="trash" onClick={onDelete} title="Delete (Del)" aria-label="Delete object">
					Delete
				</Button>
			</div>

			{textual ? (
				<Section title={o.kind === 'button' ? 'Button' : 'Text'}>
					<textarea className="insp__text" aria-label="Text" value={o.text || ''} rows={3} maxLength={1500} onChange={(e) => set({ text: e.target.value })} />
					<AiButton feature="Rewrite this text">Rewrite</AiButton>
					<Row label="Size">
						<Num label="Font size" value={st.fs ?? 40} min={8} max={400} onChange={(v) => sty({ fs: v })} suffix="px" />
						<Select aria-label="Weight" value={String(st.fw ?? 500)} onChange={(e) => sty({ fw: Number(e.target.value) })}>
							{[[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Black']].map(([v, l]) => (
								<option key={v} value={v}>
									{l}
								</option>
							))}
						</Select>
					</Row>
					<Row label="Style">
						<Seg label="Emphasis" value={`${st.it ? 'i' : ''}${st.ul ? 'u' : ''}` || 'n'} options={[{ id: 'n', label: 'Plain' }, { id: 'i', label: 'Italic' }, { id: 'u', label: 'Underline' }]} onChange={(id) => sty({ it: id === 'i', ul: id === 'u' })} />
					</Row>
					<Row label="Align">
						<Seg label="Horizontal" value={st.al || 'left'} options={[{ id: 'left', label: 'Left' }, { id: 'center', label: 'Centre' }, { id: 'right', label: 'Right' }]} onChange={(v) => sty({ al: v })} />
					</Row>
					{o.kind === 'text' ? (
						<Row label="Vertical">
							<Seg label="Vertical" value={st.va || 'top'} options={[{ id: 'top', label: 'Top' }, { id: 'middle', label: 'Middle' }, { id: 'bottom', label: 'Bottom' }]} onChange={(v) => sty({ va: v })} />
						</Row>
					) : null}
					<Row label="Font">
						<Select aria-label="Font family" value={st.ff || 'default'} onChange={(e) => sty({ ff: e.target.value })}>
							{Object.keys(FONT_STACKS).map((k) => (
								<option key={k} value={k}>
									{k === 'default' ? 'Sans (default)' : k[0].toUpperCase() + k.slice(1)}
								</option>
							))}
						</Select>
					</Row>
					<Row label="Colour">
						<ColorField label="Text colour" value={st.color || 'theme:text'} onChange={(v) => sty({ color: v })} />
					</Row>
					<Row label="Spacing">
						<Num label="Line height" value={st.lh ?? 1.2} min={0.8} max={3} step={0.05} onChange={(v) => sty({ lh: v })} suffix="line" />
						<Num label="Letter spacing" value={st.ls ?? 0} min={-5} max={40} onChange={(v) => sty({ ls: v })} suffix="px" />
					</Row>
					{o.kind === 'button' ? (
						<>
							<Row label="Fill">
								<ColorField label="Button colour" value={st.fill || 'theme:accent'} onChange={(v) => sty({ fill: v })} />
							</Row>
							<Row label="Corners">
								<Num label="Corner radius" value={st.r ?? 999} min={0} max={600} onChange={(v) => sty({ r: v })} suffix="px" />
							</Row>
						</>
					) : null}
				</Section>
			) : null}

			{o.kind === 'shape' ? (
				<Section title="Shape">
					<Row label="Form">
						<Select aria-label="Shape" value={o.shape || 'rect'} onChange={(e) => set({ shape: e.target.value })}>
							{SHAPES.map((s) => (
								<option key={s.id} value={s.id}>
									{s.label}
								</option>
							))}
						</Select>
					</Row>
					<Row label="Fill">
						<ColorField label="Fill colour" value={st.fill || 'theme:accent'} onChange={(v) => sty({ fill: v })} allowNone />
					</Row>
					<Row label="Fade to" hint="A second colour makes a diagonal gradient">
						<ColorField label="Second fill colour" value={st.fill2 || 'transparent'} onChange={(v) => sty({ fill2: v === 'transparent' ? undefined : v })} allowNone />
					</Row>
					<Row label="Opacity">
						<input type="range" aria-label="Opacity" min="0" max="1" step="0.05" value={st.op ?? 1} onChange={(e) => sty({ op: Number(e.target.value) })} />
					</Row>
					{o.shape === 'rect' || o.shape === undefined ? (
						<Row label="Corners">
							<Num label="Corner radius" value={st.r ?? 0} min={0} max={600} onChange={(v) => sty({ r: v })} suffix="px" />
						</Row>
					) : null}
					<Row label="Border">
						<Num label="Border width" value={st.bw ?? 0} min={0} max={40} onChange={(v) => sty({ bw: v })} suffix="px" />
					</Row>
					{st.bw ? (
						<Row label="Border colour">
							<ColorField label="Border colour" value={st.bc || 'theme:text'} onChange={(v) => sty({ bc: v })} />
						</Row>
					) : null}
				</Section>
			) : null}

			{o.kind === 'image' ? (
				<Section title="Picture">
					<Row label="Link" hint="https address of a picture, or upload a small one (logos, icons)">
						<input className="insp__input" aria-label="Picture address" placeholder="https://…" value={o.src && o.src.startsWith('data:') ? '(uploaded picture)' : o.src || ''} onChange={(e) => set({ src: e.target.value.trim() })} readOnly={Boolean(o.src && o.src.startsWith('data:'))} />
					</Row>
					<div className="insp__actions">
						<Button size="sm" icon="upload" onClick={() => fileRef.current && fileRef.current.click()} loading={busy}>
							Upload picture
						</Button>
						{o.src ? (
							<Button size="sm" variant="ghost" onClick={() => set({ src: '' })}>
								Remove
							</Button>
						) : null}
						<input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" aria-label="Upload picture file" onChange={upload} />
					</div>
					<Row label="Fit">
						<Seg label="Picture fit" value={o.fit || 'cover'} options={[{ id: 'cover', label: 'Fill' }, { id: 'contain', label: 'Fit inside' }]} onChange={(v) => set({ fit: v })} />
					</Row>
					<Row label="Description">
						<input className="insp__input" aria-label="Picture description" value={o.alt || ''} maxLength={160} onChange={(e) => set({ alt: e.target.value })} />
					</Row>
					<Row label="Corners">
						<Num label="Corner radius" value={st.r ?? 0} min={0} max={600} onChange={(v) => sty({ r: v })} suffix="px" />
					</Row>
				</Section>
			) : null}

			{o.kind === 'widget' ? (
				<Section title="Live data">
					<Row label="Show as">
						<Select
							aria-label="Widget type"
							value={o.widget.type}
							onChange={(e) => {
								const type = e.target.value;
								const ok = metricsFor(type).some((m) => m.id === o.widget.metric);
								set({ widget: { ...o.widget, type, metric: ok ? o.widget.metric : defaultMetric(type), compare: type === 'kpi' ? o.widget.compare : false } });
							}}
						>
							{WIDGET_TYPES.map((w) => (
								<option key={w.id} value={w.id}>
									{w.label}
								</option>
							))}
						</Select>
					</Row>
					<Row label="Measure">
						<Select aria-label="Measure" value={o.widget.metric} onChange={(e) => set({ widget: { ...o.widget, metric: e.target.value } })}>
							{metricsFor(o.widget.type).map((m) => (
								<option key={m.id} value={m.id}>
									{m.label}
								</option>
							))}
						</Select>
					</Row>
					{['bars', 'donut', 'leaders'].includes(o.widget.type) ? (
						<Row label="Show top">
							<Num label="How many to show" value={o.widget.top} min={1} max={10} onChange={(v) => set({ widget: { ...o.widget, top: v } })} />
						</Row>
					) : null}
					{o.widget.type === 'kpi' ? (
						<Row label="Compare" hint="Shows the change on the period just before">
							<label className="insp__check">
								<input type="checkbox" checked={Boolean(o.widget.compare)} onChange={(e) => set({ widget: { ...o.widget, compare: e.target.checked } })} /> Previous period
							</label>
						</Row>
					) : null}
					<Row label="Text">
						<ColorField label="Widget text colour" value={st.color || 'theme:text'} onChange={(v) => sty({ color: v })} />
					</Row>
					<Row label="Card">
						<ColorField label="Widget card colour" value={st.fill || 'transparent'} onChange={(v) => sty({ fill: v })} allowNone />
					</Row>
					<Row label="Accent">
						<ColorField label="Widget accent colour" value={st.fill2 || 'transparent'} onChange={(v) => sty({ fill2: v === 'transparent' ? undefined : v })} allowNone />
					</Row>
					<Row label="Corners">
						<Num label="Corner radius" value={st.r ?? 28} min={0} max={600} onChange={(v) => sty({ r: v })} suffix="px" />
					</Row>
				</Section>
			) : null}

			<Section title="Position">
				<div className="insp__grid">
					<label>
						X <Num label="X" value={o.x} onChange={(v) => set({ x: v })} />
					</label>
					<label>
						Y <Num label="Y" value={o.y} onChange={(v) => set({ y: v })} />
					</label>
					<label>
						W <Num label="Width" value={o.w} min={4} onChange={(v) => set({ w: v })} />
					</label>
					<label>
						H <Num label="Height" value={o.h} min={2} onChange={(v) => set({ h: v })} />
					</label>
					<label>
						Turn <Num label="Rotation" value={o.rot || 0} min={-360} max={360} onChange={(v) => set({ rot: v })} suffix="°" />
					</label>
				</div>
			</Section>

			<Section title="Motion">
				<Row label="Enter">
					<Select aria-label="Entrance animation" value={anim.in} onChange={(e) => set({ anim: e.target.value === 'none' ? undefined : { ...anim, in: e.target.value } })}>
						{ANIMATIONS.map((a) => (
							<option key={a.id} value={a.id}>
								{a.label}
							</option>
						))}
					</Select>
				</Row>
				{anim.in !== 'none' ? (
					<>
						<Row label="Start">
							<Select aria-label="When it appears" value={String(anim.step || 0)} onChange={(e) => set({ anim: { ...anim, step: Number(e.target.value) } })}>
								<option value="0">With the slide</option>
								{[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
									<option key={n} value={n}>
										On click {n}
									</option>
								))}
							</Select>
						</Row>
						<Row label="Timing">
							<Num label="Delay" value={anim.delay || 0} min={0} max={10000} step={50} onChange={(v) => set({ anim: { ...anim, delay: v } })} suffix="ms wait" />
							<Num label="Duration" value={anim.dur || 600} min={100} max={3000} step={50} onChange={(v) => set({ anim: { ...anim, dur: v } })} suffix="ms" />
						</Row>
					</>
				) : null}
				<Row label="On hover">
					<Select aria-label="Hover effect" value={o.hover || 'none'} onChange={(e) => set({ hover: e.target.value === 'none' ? undefined : e.target.value })}>
						{HOVERS.map((h) => (
							<option key={h.id} value={h.id}>
								{h.label}
							</option>
						))}
					</Select>
				</Row>
			</Section>

			{o.kind !== 'widget' ? (
				<Section title="Link">
					<input className="insp__input" aria-label="Link address" placeholder="https://…  or  #slide-3" value={o.link || ''} onChange={(e) => set({ link: e.target.value.trim() || undefined })} />
					<small className="insp__hint">Opens in a new tab while presenting. Use #slide-3 to jump to slide 3 (of {slideCount}).</small>
				</Section>
			) : null}
		</div>
	);
}

// ---- slide ----------------------------------------------------------------------------------------------

export function SlidePanel({ slide, theme, transition, onPatch, onApplyAll, onApplyLook, onAnimateAll }) {
	const bg = slide.bg || { kind: 'theme' };
	const set = (patch) => onPatch(patch, `slide-${slide.id}`);
	const setBg = (patch) => set({ bg: { ...bg, ...patch } });
	return (
		<div className="insp">
			<Section title="Slide">
				<Row label="Name">
					<input className="insp__input" aria-label="Slide name" value={slide.name || ''} maxLength={80} placeholder="Untitled slide" onChange={(e) => set({ name: e.target.value })} />
				</Row>
				<Row label="Background">
					<Seg label="Background type" value={bg.kind} options={[{ id: 'theme', label: 'Theme' }, { id: 'solid', label: 'Colour' }, { id: 'gradient', label: 'Gradient' }]} onChange={(kind) => setBg({ kind, ...(kind !== 'theme' && !bg.color ? { color: '#14181f' } : {}), ...(kind === 'gradient' && !bg.color2 ? { color2: '#2a3340', angle: 135 } : {}) })} />
				</Row>
				{bg.kind !== 'theme' ? (
					<Row label={bg.kind === 'gradient' ? 'From' : 'Colour'}>
						<ColorField label="Background colour" value={bg.color} onChange={(v) => setBg({ color: v })} />
					</Row>
				) : null}
				{bg.kind === 'gradient' ? (
					<>
						<Row label="To">
							<ColorField label="Background colour 2" value={bg.color2} onChange={(v) => setBg({ color2: v })} />
						</Row>
						<Row label="Angle">
							<input type="range" aria-label="Gradient angle" min="0" max="360" value={bg.angle ?? 135} onChange={(e) => setBg({ angle: Number(e.target.value) })} />
						</Row>
					</>
				) : null}
				{onApplyAll ? (
					<Button size="sm" onClick={onApplyAll}>
						Use this background on every slide
					</Button>
				) : null}
			</Section>
			<Section title="Theme and animation">
				<LookPicker theme={theme} transition={transition} onTheme={(id) => onPatch({ theme: id })} onTransition={(id) => onPatch({ transition: id })} />
				{onApplyLook ? (
					<Button size="sm" onClick={onApplyLook}>
						Use this theme and transition on every slide
					</Button>
				) : null}
				{onAnimateAll ? (
					<Button size="sm" onClick={onAnimateAll}>
						Animate everything on this slide, one after another
					</Button>
				) : null}
			</Section>
			<Section title="Speaker notes">
				<textarea className="insp__text" aria-label="Speaker notes" rows={5} maxLength={1000} placeholder="Only you see these (they are saved with the slide)." value={slide.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
			</Section>
		</div>
	);
}

export { colorCss };
