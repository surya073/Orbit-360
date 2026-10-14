import React from 'react';
import { useTheme } from '../../app/providers/ThemeProvider';
import Icon from '../../components/common/Icon';
import { DENSITIES, SYSTEM_THEME, THEMES } from '../../config/themes';
import Field from '../../components/forms/Field';

/**
 * Visual theme picker. Each preview is scoped with data-theme so it paints with that theme's
 * real tokens (nothing is duplicated). Selecting applies immediately and persists.
 */
export default function ThemeSelector() {
	const { theme, resolved, setTheme, density, setDensity } = useTheme();
	const options = [...THEMES, { ...SYSTEM_THEME, preview: resolved }];

	const onKey = (e, i) => {
		const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
		if (!dir) return;
		e.preventDefault();
		const next = options[(i + dir + options.length) % options.length];
		setTheme(next.id);
		document.getElementById(`theme-${next.id}`).focus();
	};

	return (
		<div className="stack">
			<div className="theme-grid" role="radiogroup" aria-label="Theme">
				{options.map((t, i) => (
					<button key={t.id} id={`theme-${t.id}`} type="button" role="radio" aria-checked={theme === t.id} tabIndex={theme === t.id ? 0 : -1} className="theme-option" onClick={() => setTheme(t.id)} onKeyDown={(e) => onKey(e, i)}>
						<div className="theme-preview" data-theme={t.preview || t.id} aria-hidden="true">
							<div className="theme-preview__bar">
								<i />
								<i />
								<i />
							</div>
							<div className="theme-preview__body">
								<div className="theme-preview__card">
									<i />
									<i />
								</div>
								<div className="theme-preview__card">
									<i />
									<i />
								</div>
							</div>
						</div>
						<div className="theme-option__meta">
							<span>
								<b>{t.label}</b>
								<span className="small muted" style={{ display: 'block' }}>
									{t.description}
								</span>
							</span>
							{theme === t.id ? <Icon name="check" size={16} className="theme-option__check" label="Selected" /> : null}
						</div>
					</button>
				))}
			</div>
			<div className="form-grid" style={{ maxWidth: 420 }}>
				<Field label="Table density" hint="Applies to tables and controls">
					{(p) => (
						<select {...p} value={density} onChange={(e) => setDensity(e.target.value)}>
							{DENSITIES.map((d) => (
								<option key={d.id} value={d.id}>
									{d.label}
								</option>
							))}
						</select>
					)}
				</Field>
			</div>
			<p className="small muted">Saved on this device. “System” follows your device’s light or dark setting and updates when it changes.</p>
		</div>
	);
}
