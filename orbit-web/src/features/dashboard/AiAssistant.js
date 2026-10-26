import React, { useCallback, useRef, useState } from 'react';
import FloatingPanel from '../../components/common/FloatingPanel';
import Icon from '../../components/common/Icon';

// What the assistant is planned to do. Nothing here is wired to a model yet; the panel says so.
const PLANNED = [
	{ icon: 'search', title: 'Ask your data', body: 'Plain-language questions such as “Which projects ran over estimate last month?”, answered from the same approved figures as the dashboard.' },
	{ icon: 'trend', title: 'Weekly briefing', body: 'A short written summary of billable share, late check-ins and project health, ready for Monday.' },
	{ icon: 'alert', title: 'Early warnings', body: 'Flags projects likely to pass their estimate, and teams whose late rate is climbing.' },
	{ icon: 'present', title: 'Draft the deck', body: 'Builds a presentation outline from the filters you have selected.' },
];

/** The AI entry point at the top right of the dashboard. Planned features only: it explains them and sends nothing anywhere. */
export default function AiAssistant() {
	const [open, setOpen] = useState(false);
	const btn = useRef(null);
	const close = useCallback(() => setOpen(false), []);
	return (
		<div className="assist">
			<button type="button" ref={btn} className="assist__btn" aria-haspopup="dialog" aria-expanded={open} aria-label="AI assistant (planned)" title="AI assistant: coming soon" onClick={() => setOpen((o) => !o)}>
				<Icon name="sparkles" size={20} />
				<span className="assist__soon" aria-hidden="true" />
			</button>
			<FloatingPanel anchorRef={btn} open={open} onClose={close} align="right" width={420} className="assist__panel" role="dialog" aria-label="AI assistant">
					<header className="assist__head">
						<span className="assist__badge" aria-hidden="true">
							<Icon name="sparkles" size={18} />
						</span>
						<div>
							<h2>Orbit 360 AI</h2>
							<p>Planned features. Not connected yet, so nothing you type here is sent anywhere.</p>
						</div>
						<span className="assist__tag">Coming soon</span>
					</header>
					<ul className="assist__list">
						{PLANNED.map((f) => (
							<li key={f.title}>
								<span className="assist__icon" aria-hidden="true">
									<Icon name={f.icon} size={16} />
								</span>
								<div>
									<b>{f.title}</b>
									<small>{f.body}</small>
								</div>
								<span className="assist__planned">Planned</span>
							</li>
						))}
					</ul>
					<div className="assist__ask">
						<input type="text" className="input" disabled aria-label="Ask a question (not available yet)" placeholder="Ask about your projects, hours or people…" />
						<button type="button" className="btn btn--primary" disabled title="Available when the AI assistant ships">
							Ask
						</button>
					</div>
			</FloatingPanel>
		</div>
	);
}
