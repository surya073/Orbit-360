import React, { useState } from 'react';
import { useTheme } from '../../app/providers/ThemeProvider';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import { ACCENT_PRESETS } from '../../config/themes';
import { isHex } from '../../utils/accent';

/**
 * Optional accent colour on top of any theme. Pick a swatch, or choose or type your own: the colour is
 * adjusted automatically so text and buttons stay readable on the active theme.
 */
export default function AccentPicker() {
	const { accent, setAppearance } = useTheme();
	const [draft, setDraft] = useState(accent || '');
	const apply = (hex) => {
		setDraft(hex);
		setAppearance({ accent: hex });
	};
	const onType = (v) => {
		const next = v.startsWith('#') ? v : `#${v}`;
		setDraft(v);
		if (isHex(next)) setAppearance({ accent: next.toLowerCase() });
	};
	return (
		<div className="stack">
			<div className="swatches" role="radiogroup" aria-label="Accent colour">
				<button type="button" role="radio" aria-checked={!accent} className="swatch swatch--theme" onClick={() => apply('')} title="Use the theme's own accent">
					<Icon name="palette" size={14} />
					<span className="sr-only">Theme default</span>
				</button>
				{ACCENT_PRESETS.map((c) => (
					<button key={c} type="button" role="radio" aria-checked={accent === c} className="swatch" style={{ '--swatch': c }} onClick={() => apply(c)} title={c}>
						{accent === c ? <Icon name="check" size={14} /> : null}
						<span className="sr-only">{c}</span>
					</button>
				))}
			</div>
			<div className="accent-custom">
				<label className="accent-custom__pick">
					<span className="small muted">Custom</span>
					<input type="color" aria-label="Pick a custom accent colour" value={isHex(accent) ? accent : '#ff8a3d'} onChange={(e) => apply(e.target.value)} />
				</label>
				<input type="text" className="input accent-custom__hex" aria-label="Accent colour as hex" placeholder="#ff8a3d" maxLength={7} value={draft} onChange={(e) => onType(e.target.value)} spellCheck={false} />
				<Button variant="ghost" icon="refresh" disabled={!accent} onClick={() => apply('')}>
					Use theme colour
				</Button>
			</div>
			<div className="accent-preview" aria-hidden="true">
				<span className="btn btn--primary">Primary</span>
				<span className="badge badge--info">Badge</span>
				<span className="accent-preview__bar">
					<i />
				</span>
				<a href="#preview" tabIndex={-1} onClick={(e) => e.preventDefault()}>
					Link
				</a>
			</div>
			<p className="small muted">Applies everywhere on this device. Status colours (success, warning, danger) never change.</p>
		</div>
	);
}
