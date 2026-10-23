import React from 'react';
import { PRESENTATION_THEMES, TRANSITIONS, themeById } from '../presentationThemes';
import ThemePreview from '../ThemePreview';

/**
 * The deck's look: a colour theme (live miniatures painted with the real theme tokens) and the slide transition.
 * Used on the start page (before the deck exists) and in the editor's slide panel, so both offer the same choices.
 */
export default function LookPicker({ theme, transition, onTheme, onTransition }) {
	const current = themeById(theme);
	return (
		<div className="look">
			<b className="look__h">Colour theme</b>
			<div role="radiogroup" aria-label="Colour theme" className="look__themes">
				{PRESENTATION_THEMES.map((t) => (
					<button key={t.id} type="button" role="radio" aria-checked={t.id === theme} className={`look__theme ${t.id === theme ? 'is-selected' : ''}`.trim()} title={t.name} onClick={() => onTheme(t.id)}>
						<ThemePreview theme={t} kind="content" className="look__thumb" />
						<span>{t.name}</span>
					</button>
				))}
			</div>
			<b className="look__h">Slide transition (how the next slide comes in)</b>
			<div role="radiogroup" aria-label="Slide transition" className="look__trans">
				{TRANSITIONS.map((x) => (
					<button key={x.id} type="button" role="radio" aria-checked={x.id === transition} className={`look__chip ${x.id === transition ? 'is-selected' : ''}`.trim()} onClick={() => onTransition(x.id)}>
						{x.id === 'auto' ? `${x.label} (${(TRANSITIONS.find((y) => y.id === current.motion) || TRANSITIONS[1]).label})` : x.label}
					</button>
				))}
			</div>
		</div>
	);
}
