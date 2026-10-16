import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, readAppearance, resolveTheme } from '../app/providers/ThemeProvider';
import { APPEARANCE_KEY, THEME_IDS } from '../config/themes';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from '../features/settings/SettingsPage';
import ThemeSelector from '../features/settings/ThemeSelector';

// ---- accessibility of the palettes themselves -------------------------------------------------
const css = fs.readFileSync(path.join(__dirname, '../styles/themes.css'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, '../styles/themes.extra.css'), 'utf8');

function tokensFor(id) {
	const re = id === 'blueberry' ? /:root,\s*\[data-theme='blueberry'\]\s*\{([^}]*)\}/ : new RegExp(`\\[data-theme='${id}'\\]\\s*\\{([^}]*)\\}`);
	const block = re.exec(css);
	if (!block) throw new Error(`theme ${id} not found`);
	return Object.fromEntries([...block[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
}
const lum = (hex) => {
	const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
	const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
};

describe.each(THEME_IDS)('theme %s', (id) => {
	const t = tokensFor(id);
	test('defines the full token contract', () => {
		for (const k of ['bg', 'surface', 'surface-2', 'surface-3', 'border', 'border-strong', 'text', 'text-muted', 'accent', 'accent-hover', 'accent-contrast', 'on-accent', 'accent-soft', 'focus', 'scrollbar', 'success', 'warning', 'danger', 'info', 'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6', 'chart-grid']) {
			expect(t[k]).toBeDefined();
		}
	});
	test('text, muted text and accent meet WCAG AA (4.5:1) on every surface', () => {
		for (const surface of ['bg', 'surface', 'surface-2']) {
			expect(contrast(t.text, t[surface])).toBeGreaterThanOrEqual(4.5);
			expect(contrast(t['text-muted'], t[surface])).toBeGreaterThanOrEqual(4.5);
		}
		expect(contrast(t.accent, t.surface)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(t.accent, t['accent-soft'])).toBeGreaterThanOrEqual(4.5);
		expect(contrast(t['accent-contrast'], t.accent)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(t['accent-contrast'], t['accent-hover'])).toBeGreaterThanOrEqual(4.5);
	});
	test('status colors are readable as text on their soft backgrounds and on the surface', () => {
		for (const s of ['success', 'warning', 'danger', 'info']) {
			expect(contrast(t[s], t[`${s}-soft`])).toBeGreaterThanOrEqual(4.5);
			expect(contrast(t[s], t.surface)).toBeGreaterThanOrEqual(4.5);
		}
	});
	test('chart colors and the focus ring are distinguishable from the surface (3:1 for graphics)', () => {
		for (let i = 1; i <= 6; i++) expect(contrast(t[`chart-${i}`], t.surface)).toBeGreaterThanOrEqual(3);
		expect(contrast(t.focus, t.surface)).toBeGreaterThanOrEqual(3);
		expect(contrast(t.focus, t.bg)).toBeGreaterThanOrEqual(3);
	});
});

// ---- provider behaviour -----------------------------------------------------------------------
const dark = (matches) => {
	window.matchMedia = (q) => ({ matches: q.includes('dark') ? matches : false, media: q, addEventListener() {}, removeEventListener() {} });
};

test('defaults to Ember, applies attributes, and persists a selection', async () => {
	render(
		<ThemeProvider>
			<ThemeSelector />
		</ThemeProvider>
	);
	expect(document.documentElement.dataset.theme).toBe('ember');
	await userEvent.click(screen.getByRole('radio', { name: /sunset/i }));
	expect(document.documentElement.dataset.theme).toBe('sunset');
	expect(JSON.parse(localStorage.getItem(APPEARANCE_KEY)).theme).toBe('sunset');
	expect(screen.getByRole('radio', { name: /sunset/i })).toHaveAttribute('aria-checked', 'true');
});

test('the gallery offers every theme plus an explicit System option, each with a preview, and filters by dark / light', async () => {
	render(
		<ThemeProvider>
			<ThemeSelector />
		</ThemeProvider>
	);
	const group = screen.getByRole('radiogroup', { name: 'Theme' });
	const names = within(group).getAllByRole('radio').map((r) => r.querySelector('b').textContent);
	expect(names.slice(0, 7)).toEqual(['Ember', 'Light Blueberry', 'Black Current', 'Volcano', 'Sunset', 'Ocean', 'Forest']);
	expect(names[names.length - 1]).toBe('System');
	expect(names.length).toBe(THEME_IDS.length + 1);
	expect(THEME_IDS.length).toBeGreaterThanOrEqual(25);
	expect(group.querySelectorAll('.theme-preview[data-theme]').length).toBe(THEME_IDS.length + 1);
	await userEvent.click(screen.getByRole('button', { name: /^Dark/ }));
	const darkNames = within(group).getAllByRole('radio').map((r) => r.querySelector('b').textContent);
	expect(darkNames).toContain('Ember');
	expect(darkNames).not.toContain('Sunset');
	await userEvent.click(screen.getByRole('button', { name: /^Light/ }));
	expect(within(group).getAllByRole('radio').map((r) => r.querySelector('b').textContent)).toContain('Sunset');
	await userEvent.click(screen.getByRole('button', { name: /^All/ }));
	await userEvent.type(screen.getByRole('searchbox', { name: 'Search themes' }), 'nord');
	expect(within(group).getAllByRole('radio').map((r) => r.querySelector('b').textContent)).toEqual(['Nord']);
}, 20000);

test('accent colour, corner style, text size and motion apply to the document and persist', async () => {
	render(
		<ThemeProvider>
			<SettingsPage />
		</ThemeProvider>,
		{ wrapper: MemoryRouter }
	);
	await userEvent.click(screen.getByRole('radio', { name: 'Round' }));
	await userEvent.click(screen.getByRole('radio', { name: 'Large' }));
	await userEvent.click(screen.getByRole('radio', { name: 'Reduce motion' }));
	const root = document.documentElement;
	expect([root.dataset.radius, root.dataset.text, root.dataset.motion]).toEqual(['round', 'large', 'reduced']);
	const stored = JSON.parse(localStorage.getItem(APPEARANCE_KEY));
	expect(stored).toMatchObject({ radius: 'round', textSize: 'large', motion: 'reduced' });
	await userEvent.type(screen.getByRole('textbox', { name: 'Accent colour as hex' }), '#12a594');
	expect(JSON.parse(localStorage.getItem(APPEARANCE_KEY)).accent).toBe('#12a594');
	expect(readAppearance().accent).toBe('#12a594');
}, 20000);

test('a stored theme is restored on startup; invalid stored data falls back safely', () => {
	localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ theme: 'volcano', density: 'compact' }));
	render(<ThemeProvider><span /></ThemeProvider>);
	expect(document.documentElement.dataset.theme).toBe('volcano');
	expect(document.documentElement.dataset.density).toBe('compact');
	localStorage.setItem(APPEARANCE_KEY, '{not json');
	expect(readAppearance()).toEqual({ theme: 'ember', density: 'comfortable', iconStyle: 'tabler', accent: '', radius: 'default', textSize: 'default', motion: 'auto', width: 'standard' });
	localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ theme: 'neon', density: 'huge' }));
	expect(readAppearance()).toEqual({ theme: 'ember', density: 'comfortable', iconStyle: 'tabler', accent: '', radius: 'default', textSize: 'default', motion: 'auto', width: 'standard' });
});

test('System follows the device preference only when selected', async () => {
	dark(true);
	render(
		<ThemeProvider>
			<ThemeSelector />
		</ThemeProvider>
	);
	expect(document.documentElement.dataset.theme).toBe('ember'); // explicit default is not "system"
	await userEvent.click(screen.getByRole('radio', { name: /system/i }));
	expect(document.documentElement.dataset.theme).toBe('blackcurrant');
	expect(document.documentElement.dataset.themePref).toBe('system');
	expect(resolveTheme('system', false)).toBe('blueberry');
	expect(resolveTheme('ocean', true)).toBe('ocean');
});

test('themes saved by earlier versions migrate to their closest successor', () => {
	for (const [old, next] of [['light', 'blueberry'], ['dark', 'blackcurrant'], ['moon', 'blackcurrant'], ['beach', 'ocean'], ['sunset', 'sunset']]) {
		localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ theme: old }));
		expect(readAppearance().theme).toBe(next);
	}
});

test('storage failures do not break theming (session-only fallback)', async () => {
	const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
		throw new Error('blocked');
	});
	render(
		<ThemeProvider>
			<ThemeSelector />
		</ThemeProvider>
	);
	await userEvent.click(screen.getByRole('radio', { name: /ocean/i }));
	expect(document.documentElement.dataset.theme).toBe('ocean');
	spy.mockRestore();
});

test('theme switches ease colors briefly unless reduced motion is requested', async () => {
	jest.useFakeTimers();
	const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
	render(
		<ThemeProvider>
			<ThemeSelector />
		</ThemeProvider>
	);
	await user.click(screen.getByRole('radio', { name: /^black current/i }));
	expect(document.documentElement.classList.contains('theme-transition')).toBe(true);
	act(() => jest.advanceTimersByTime(400));
	expect(document.documentElement.classList.contains('theme-transition')).toBe(false);

	window.matchMedia = (q) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} });
	await user.click(screen.getByRole('radio', { name: /forest/i }));
	expect(document.documentElement.classList.contains('theme-transition')).toBe(false);
	jest.useRealTimers();
});
