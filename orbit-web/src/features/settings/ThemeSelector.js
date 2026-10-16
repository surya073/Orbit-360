import React, { useMemo, useState } from 'react';
import { useTheme } from '../../app/providers/ThemeProvider';
import Icon from '../../components/common/Icon';
import { SYSTEM_THEME, THEMES } from '../../config/themes';

const FILTERS = [
	{ id: 'all', label: 'All' },
	{ id: 'dark', label: 'Dark', icon: 'moon' },
	{ id: 'light', label: 'Light', icon: 'sun' },
];

/**
 * Visual theme gallery: 29 themes, filterable by dark / light and searchable by name. Each card paints a
 * miniature of the real interface (top bar, KPI cards, a chart) scoped with data-theme, so it uses that
 * theme's actual tokens. Selecting applies immediately and persists. Arrow keys move through the visible cards.
 */
export default function ThemeSelector() {
	const { theme, resolved, setTheme } = useTheme();
	const [filter, setFilter] = useState('all');
	const [q, setQ] = useState('');
	const needle = q.trim().toLowerCase();

	const options = useMemo(() => {
		const list = THEMES.filter((t) => (filter === 'all' || t.scheme === filter) && (!needle || `${t.label} ${t.description}`.toLowerCase().includes(needle)));
		const showSystem = filter === 'all' && (!needle || 'system device automatic'.includes(needle));
		return showSystem ? [...list, { ...SYSTEM_THEME, preview: resolved }] : list;
	}, [filter, needle, resolved]);
	const count = (id) => (id === 'all' ? THEMES.length : THEMES.filter((t) => t.scheme === id).length);

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
			<div className="theme-tools">
				<div className="view-toggle" role="group" aria-label="Show themes">
					{FILTERS.map((f) => (
						<button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
							{f.icon ? <Icon name={f.icon} size={14} /> : null} {f.label} <span className="theme-tools__n">{count(f.id)}</span>
						</button>
					))}
				</div>
				<input type="search" className="input theme-tools__search" aria-label="Search themes" placeholder="Search themes" value={q} onChange={(e) => setQ(e.target.value)} />
			</div>
			<div className="theme-grid" role="radiogroup" aria-label="Theme">
				{options.map((t, i) => (
					<button key={t.id} id={`theme-${t.id}`} type="button" role="radio" aria-checked={theme === t.id} tabIndex={theme === t.id || (i === 0 && !options.some((o) => o.id === theme)) ? 0 : -1} className="theme-option" onClick={() => setTheme(t.id)} onKeyDown={(e) => onKey(e, i)}>
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
						{t.scheme ? <span className={`theme-option__scheme theme-option__scheme--${t.scheme}`}>{t.scheme === 'dark' ? 'Dark' : 'Light'}</span> : <span className="theme-option__scheme">Auto</span>}
					</button>
				))}
			</div>
			{options.length === 0 ? <p className="muted" role="status">No theme matches “{q}”.</p> : null}
			<p className="small muted">Saved on this device. “System” follows your device’s light or dark setting and updates when it changes.</p>
		</div>
	);
}
