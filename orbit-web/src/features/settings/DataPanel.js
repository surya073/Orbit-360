import React, { useMemo, useRef, useState } from 'react';
import Card from '../../components/cards/Card';
import Button from '../../components/common/Button';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/feedback/ToastProvider';

const PREFIX = 'company360.';
const MAX_BYTES = 256 * 1024;

const readAll = () => {
	const out = {};
	try {
		for (let i = 0; i < window.localStorage.length; i++) {
			const k = window.localStorage.key(i);
			if (k && k.startsWith(PREFIX)) out[k] = window.localStorage.getItem(k);
		}
	} catch {
		/* storage unavailable: nothing to export */
	}
	return out;
};

/** Parse and validate a settings file: only our own keys, only string values. Throws a readable message. */
export function parseSettingsFile(text) {
	let data;
	try {
		data = JSON.parse(text);
	} catch {
		throw new Error('That file is not valid JSON.');
	}
	if (!data || data.app !== 'company360' || typeof data.settings !== 'object' || data.settings === null) throw new Error('That is not a Orbit 360 settings file.');
	const entries = Object.entries(data.settings);
	if (entries.length === 0) throw new Error('The file holds no settings.');
	for (const [k, v] of entries) {
		if (!k.startsWith(PREFIX) || typeof v !== 'string' || v.length > 50000) throw new Error('The file contains entries that are not Orbit 360 settings.');
	}
	return Object.fromEntries(entries);
}

/**
 * Back up, move or reset this device's preferences (theme, accent, layout, dashboard widgets, saved views).
 * Nothing here touches company data or access: these are display preferences kept in this browser only.
 */
export default function DataPanel() {
	const { notify } = useToast();
	const file = useRef(null);
	const [confirm, setConfirm] = useState(false);
	const stored = useMemo(() => Object.keys(readAll()), []);

	const exportSettings = () => {
		const body = { app: 'company360', version: 1, exportedAt: new Date().toISOString(), settings: readAll() };
		const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = 'company360-settings.json';
		a.click();
		URL.revokeObjectURL(url);
		notify('Settings exported');
	};

	const importSettings = async (e) => {
		const f = e.target.files[0];
		e.target.value = '';
		if (!f) return;
		try {
			if (f.size > MAX_BYTES) throw new Error('That file is too large to be a settings file.');
			const settings = parseSettingsFile(await f.text());
			Object.entries(settings).forEach(([k, v]) => window.localStorage.setItem(k, v));
			notify(`Imported ${Object.keys(settings).length} settings. Reloading…`);
			setTimeout(() => window.location.reload(), 600);
		} catch (err) {
			notify(err.message, 'error');
		}
	};

	const reset = async () => {
		Object.keys(readAll()).forEach((k) => window.localStorage.removeItem(k));
		window.location.reload();
	};

	return (
		<div className="stack">
			<Card title="Back up and move your settings" subtitle="Theme, accent, layout, dashboard widgets and saved views, as one small file.">
				<div className="data-actions">
					<Button icon="download" onClick={exportSettings}>
						Export settings
					</Button>
					<Button icon="upload" onClick={() => file.current && file.current.click()}>
						Import settings
					</Button>
					<input ref={file} type="file" accept="application/json,.json" className="sr-only" aria-label="Settings file" tabIndex={-1} onChange={importSettings} />
				</div>
				<p className="small muted">Use this to copy your setup to another browser or computer. Importing replaces the matching settings on this device.</p>
			</Card>
			<Card title="What is saved on this device" subtitle="Display preferences only. Company data and access never live here.">
				{stored.length === 0 ? (
					<p className="muted">Nothing is saved yet. Defaults are in use.</p>
				) : (
					<ul className="stored-list">
						{stored.map((k) => (
							<li key={k}>
								<code>{k.slice(PREFIX.length)}</code>
							</li>
						))}
					</ul>
				)}
			</Card>
			<Card title="Reset" subtitle="Return every preference on this device to its default.">
				<Button variant="danger" icon="refresh" onClick={() => setConfirm(true)}>
					Reset all settings
				</Button>
			</Card>
			{confirm ? <ConfirmDialog title="Reset all settings?" message="Theme, accent, layout, dashboard widgets and saved views on this device go back to their defaults. The page reloads. Your data and access are not affected." confirmLabel="Reset" onCancel={() => setConfirm(false)} onConfirm={reset} /> : null}
		</div>
	);
}
