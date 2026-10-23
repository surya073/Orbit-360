import React from 'react';
import { useTheme } from '../../app/providers/ThemeProvider';
import Icon from '../../components/common/Icon';
import { FONTS, PALETTES, TEMPLATES, THEMES } from '../../config/themes';
import { tintColors } from '../../utils/accent';

/** Roving-radio keyboard handling shared by the three pickers (arrows move and select). */
function useRoving(items, select, prefix) {
	return (e, i) => {
		const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
		if (!dir) return;
		e.preventDefault();
		const next = items[(i + dir + items.length) % items.length];
		select(next);
		const el = document.getElementById(`${prefix}-${next.id}`);
		if (el) el.focus();
	};
}

/** Does the current appearance equal this template's choices? (the accent is ignored when the template leaves it blank) */
const matches = (prefs, t) => Object.entries(t.prefs).every(([k, v]) => (k === 'accent' && v === '' ? true : prefs[k] === v));

/** One-tap style templates: theme, shape, font and chart colours chosen to work together. */
export function TemplatePicker() {
	const prefs = useTheme();
	const onKey = useRoving(TEMPLATES, (t) => prefs.setAppearance(t.prefs), 'tpl');
	return (
		<div className="tpl-grid" role="radiogroup" aria-label="Style template">
			{TEMPLATES.map((t, i) => {
				const theme = THEMES.find((x) => x.id === t.prefs.theme);
				const font = FONTS.find((f) => f.id === t.prefs.font);
				const on = matches(prefs, t);
				return (
					<button key={t.id} id={`tpl-${t.id}`} type="button" role="radio" aria-checked={on} tabIndex={on || (i === 0 && !TEMPLATES.some((x) => matches(prefs, x))) ? 0 : -1} className="tpl" onClick={() => prefs.setAppearance(t.prefs)} onKeyDown={(e) => onKey(e, i)}>
						<span className="tpl__preview" data-theme={t.prefs.theme} data-radius={t.prefs.radius} aria-hidden="true" style={{ fontFamily: font && font.ui ? font.ui : undefined }}>
							<b>Aa</b>
							<i />
							<i />
							<i />
						</span>
						<span className="tpl__meta">
							<b>{t.label}</b>
							<small>{t.description}</small>
							<em>
								{theme ? theme.label : t.prefs.theme} · {font ? font.label : 'Meeting 360'}
							</em>
						</span>
						{on ? (
							<span className="tpl__tick" aria-hidden="true">
								<Icon name="check" size={14} />
							</span>
						) : null}
					</button>
				);
			})}
		</div>
	);
}

/** Font choice: every option is drawn in its own font. */
export function FontPicker() {
	const { font, setAppearance } = useTheme();
	const onKey = useRoving(FONTS, (f) => setAppearance({ font: f.id }), 'font');
	return (
		<div className="font-grid" role="radiogroup" aria-label="Font">
			{FONTS.map((f, i) => (
				<button key={f.id} id={`font-${f.id}`} type="button" role="radio" aria-checked={font === f.id} tabIndex={font === f.id ? 0 : -1} className="fontopt" onClick={() => setAppearance({ font: f.id })} onKeyDown={(e) => onKey(e, i)} style={{ '--sample': f.ui || 'var(--font-ui)', '--sample-head': f.display || f.ui || 'var(--font-display)' }}>
					<span className="fontopt__aa" aria-hidden="true">
						Aa
					</span>
					<span className="fontopt__text">
						<b>{f.label}</b>
						<small>{f.hint}</small>
						<span className="fontopt__sample" aria-hidden="true">
							Billable hours 1,284.5
						</span>
					</span>
				</button>
			))}
		</div>
	);
}

/** Chart colour sets, shown as the six colours they paint. */
export function PalettePicker() {
	const { palette, accent, setAppearance } = useTheme();
	const onKey = useRoving(PALETTES, (p) => setAppearance({ palette: p.id }), 'pal');
	const swatches = (p) => (p.id === 'theme' ? ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'] : p.id === 'mono' ? tintColors(/^#[0-9a-f]{6}$/i.test(accent) ? accent : '#888888') : p.colors);
	return (
		<div className="pal-grid" role="radiogroup" aria-label="Chart colours">
			{PALETTES.map((p, i) => (
				<button key={p.id} id={`pal-${p.id}`} type="button" role="radio" aria-checked={palette === p.id} tabIndex={palette === p.id ? 0 : -1} className="palopt" onClick={() => setAppearance({ palette: p.id })} onKeyDown={(e) => onKey(e, i)}>
					<span className="palopt__strip" aria-hidden="true">
						{swatches(p).map((c, k) => (
							<i key={k} style={{ background: c }} />
						))}
					</span>
					<b>{p.label}</b>
					<small>{p.hint}</small>
				</button>
			))}
		</div>
	);
}
