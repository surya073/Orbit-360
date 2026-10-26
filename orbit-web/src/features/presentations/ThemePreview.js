import React from 'react';
import { themeById, themeStyle } from './presentationThemes';

/**
 * A miniature 16:9 slide painted with the real theme tokens, so what the user sees in the launcher
 * is what the viewer renders. `kind="cover"` mirrors the opening slide (the deck's real title);
 * `kind="content"` shows a layout sketch (blocks and shapes only: no numbers or labels are made up).
 */
export default function ThemePreview({ theme, title = 'Executive briefing', subtitle, kind = 'cover', layout = 'classic', className = '' }) {
	const t = typeof theme === 'string' ? themeById(theme) : theme;
	return (
		<div className={`pscope pprev ${className}`.trim()} data-ptheme={t.id} data-playout={layout} style={themeStyle(t)} aria-hidden="true">
			<div className={`pprev__slide pprev__slide--${kind}`}>
				<span className="pprev__ambient">
					<i />
					<i />
				</span>
				{kind === 'cover' ? (
					<>
						<span className="pprev__brand">
							<i /> Orbit 360
						</span>
						<span className="pprev__kicker">Executive briefing</span>
						<b className="pprev__title">{title}</b>
						<span className="pprev__sub">{subtitle || 'Reporting period'}</span>
					</>
				) : (
					<>
						<b className="pprev__heading">Key metrics</b>
						<span className="pprev__kpis">
							<i />
							<i />
							<i />
						</span>
						<span className="pprev__charts">
							<span className="pprev__bars">
								<i style={{ height: '45%' }} />
								<i style={{ height: '70%' }} />
								<i style={{ height: '55%' }} />
								<i style={{ height: '88%' }} />
								<i style={{ height: '64%' }} />
							</span>
							<span className="pprev__ring" />
						</span>
					</>
				)}
			</div>
		</div>
	);
}
