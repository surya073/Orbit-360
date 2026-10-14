import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, readAppearance } from '../app/providers/ThemeProvider';
import Icon, { ICON_NAMES } from '../components/common/Icon';
import { ICON_SETS } from '../components/common/iconSets';
import { APPEARANCE_KEY } from '../config/themes';
import { DEFAULT_ICON_STYLE, ICON_PREVIEW, ICON_STYLES, ICON_STYLE_IDS } from '../config/icons';
import IconStyleSelector from '../features/settings/IconStyleSelector';

const svgOf = (container) => container.querySelector('svg');

describe('Icon', () => {
	test('works without a provider (default set) and is decorative unless labelled', () => {
		const { container } = render(<Icon name="clock" />);
		expect(svgOf(container)).toHaveAttribute('aria-hidden', 'true');
		expect(svgOf(container)).not.toHaveAttribute('role');
		render(<Icon name="check" label="Selected" />);
		expect(screen.getByRole('img', { name: 'Selected' })).toBeInTheDocument();
	});

	test('every icon exists in every set (nothing silently disappears when the set changes)', () => {
		for (const style of ICON_STYLE_IDS) {
			for (const name of ICON_NAMES) {
				const { container, unmount } = render(<Icon name={name} variant={style} />);
				expect(svgOf(container)).not.toBeNull();
				unmount();
			}
		}
		expect(ICON_PREVIEW.every((n) => ICON_NAMES.includes(n))).toBe(true);
	});

	test('the offered sets and the implemented sets are the same list (plus the built-in classic set)', () => {
		expect(Object.keys(ICON_SETS).sort()).toEqual(ICON_STYLE_IDS.filter((id) => id !== 'classic').sort());
		for (const [id, set] of Object.entries(ICON_SETS)) expect(Object.keys(set).sort()).toEqual([...ICON_NAMES].sort()); // identical icon names in each family
		expect(ICON_STYLE_IDS).toContain(DEFAULT_ICON_STYLE);
	});

	test('each set draws different shapes', () => {
		const html = ICON_STYLES.map((s) => render(<Icon name="calendar" variant={s.id} />).container.innerHTML);
		expect(new Set(html).size).toBe(ICON_STYLES.length);
	});

	test('unknown icon names render nothing rather than crashing; size is applied', () => {
		expect(render(<Icon name="does-not-exist" />).container).toBeEmptyDOMElement();
		const { container } = render(<Icon name="clock" size={30} variant="remix" />);
		expect(svgOf(container)).toHaveAttribute('height', '30');
	});
});

describe('icon style preference', () => {
	const renderSelector = () =>
		render(
			<ThemeProvider>
				<IconStyleSelector />
				<Icon name="clock" label="Live icon" />
			</ThemeProvider>
		);
	const radio = (label) => screen.getAllByRole('radio').find((r) => r.querySelector('b') && r.querySelector('b').textContent === label);

	test('defaults to the first set and offers every set with a live preview', () => {
		renderSelector();
		const group = screen.getByRole('radiogroup', { name: 'Icon style' });
		const names = within(group).getAllByRole('radio').map((r) => r.querySelector('b').textContent);
		expect(names).toEqual(['Tabler', 'Remix', 'Remix Solid', 'Material', 'Heroicons', 'Heroicons Solid', 'Ionicons', 'Classic']);
		expect(radio('Tabler')).toHaveAttribute('aria-checked', 'true');
		expect(group.querySelectorAll('.icon-option__preview svg').length).toBe(ICON_STYLES.length * ICON_PREVIEW.length);
		expect(document.documentElement.dataset.iconStyle).toBe(DEFAULT_ICON_STYLE);
	});

	test('choosing a set changes icons everywhere immediately and persists', async () => {
		renderSelector();
		const live = () => screen.getByRole('img', { name: 'Live icon' });
		const before = live().outerHTML;
		await userEvent.click(radio('Material'));
		expect(live().outerHTML).not.toBe(before);
		expect(JSON.parse(localStorage.getItem(APPEARANCE_KEY)).iconStyle).toBe('material');
		await userEvent.click(radio('Classic'));
		expect(live()).toHaveAttribute('viewBox', '0 0 24 24');
		expect(document.documentElement.dataset.iconStyle).toBe('classic');
	});

	test('arrow keys move the selection and wrap (roving tabindex)', async () => {
		renderSelector();
		radio('Tabler').focus();
		await userEvent.keyboard('{ArrowRight}');
		expect(radio('Remix')).toHaveAttribute('aria-checked', 'true');
		expect(radio('Remix')).toHaveFocus();
		await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
		expect(radio('Classic')).toHaveAttribute('aria-checked', 'true'); // wraps
	});

	test('stored sets are restored; removed/invalid ones (e.g. earlier "duotone") fall back to the default', () => {
		localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ theme: 'volcano', iconStyle: 'ionic' }));
		expect(readAppearance().iconStyle).toBe('ionic');
		for (const old of ['duotone', 'bold', 'neon']) {
			localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ iconStyle: old }));
			expect(readAppearance().iconStyle).toBe(DEFAULT_ICON_STYLE);
		}
		localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ theme: 'sunset' }));
		expect(readAppearance()).toMatchObject({ theme: 'sunset', iconStyle: DEFAULT_ICON_STYLE });
	});
});
