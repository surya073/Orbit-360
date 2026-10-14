import React from 'react';
import { useTheme } from '../../app/providers/ThemeProvider';
import Icon from '../../components/common/Icon';
import { SYSTEM_THEME, THEMES } from '../../config/themes';

/**
 * Visual theme picker. Each card paints a miniature of the real interface (top bar, KPI cards, a chart
 * and a primary button) scoped with data-theme, so it uses that theme's actual tokens. The selected
 * card shows a check and an accent ring. Selecting applies immediately and persists.
 */
export default function ThemeSelector() {
	const { theme, resolved, setTheme } = useTheme();
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
								<u />
								<i />
								<i />
								<i />
								<span />
							</div>
							<div className="theme-preview__body">
								<div className="theme-preview__kpis">
									<div>
										<i />
										<u />
									</div>
									<div>
										<i />
										<u />
									</div>
									<div>
										<i />
										<u />
									</div>
								</div>
								<div className="theme-preview__chart">
									<span style={{ height: '38%' }} />
									<span style={{ height: '62%' }} />
									<span style={{ height: '48%' }} />
									<span style={{ height: '82%' }} />
									<span style={{ height: '58%' }} />
									<em />
								</div>
							</div>
						</div>
						<div className="theme-option__meta">
							<span className="theme-option__name">
								<b>{t.label}</b>
								<span className="small muted">{t.description}</span>
							</span>
							<span className="theme-option__tick" aria-hidden={theme !== t.id}>
								{theme === t.id ? <Icon name="check" size={14} label="Selected" /> : null}
							</span>
						</div>
					</button>
				))}
			</div>
			<p className="small muted">Saved on this device. “System” follows your device’s light or dark setting and updates when it changes.</p>
		</div>
	);
}
