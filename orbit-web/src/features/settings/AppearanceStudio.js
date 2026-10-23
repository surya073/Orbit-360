import React, { useState } from 'react';
import { useTheme } from '../../app/providers/ThemeProvider';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import { DENSITIES, MOTIONS, RADII, TEXT_SIZES, WIDTHS } from '../../config/themes';
import { isHex } from '../../utils/accent';
import AccentPicker from './AccentPicker';
import IconStyleSelector from './IconStyleSelector';
import OptionGroup from './OptionGroup';
import { FontPicker, PalettePicker, TemplatePicker } from './StylePickers';
import ThemeSelector from './ThemeSelector';

/**
 * Appearance as a horizontal strip of icon + text toggles, one panel at a time, each panel showing everything it offers
 * the way it will look (theme previews, fonts drawn in their own typeface, whole-interface styles, icon sets): the screen
 * has the room, so nothing is hidden behind "show more" or a dropdown. Choices that are only a few words share one
 * "Layout" toggle. Everything applies at once and is kept on this device.
 */
const GROUPS = [
	{ id: 'theme', label: 'Theme', icon: 'palette' },
	{ id: 'colours', label: 'Colours', icon: 'fill' }, // accent, sidebar and card finish in one place
	{ id: 'style', label: 'Style', icon: 'sparkles' },
	{ id: 'font', label: 'Font', icon: 'edit' },
	{ id: 'charts', label: 'Charts', icon: 'trend' },
	{ id: 'layout', label: 'Layout', icon: 'dashboard' },
	{ id: 'icons', label: 'Icons', icon: 'box' },
];

const SIDEBAR_PRESETS = ['#1f2937', '#0f172a', '#111111', '#14532d', '#134e4a', '#1e3a8a', '#4c1d95', '#7c2d12', '#9f1239', '#be123c', '#b45309', '#f5f5f4', '#e0e7ff', '#fde68a'];
const CARD_FINISH = [
	{ id: 'raised', label: 'Raised' },
	{ id: 'flat', label: 'Flat' },
	{ id: 'outlined', label: 'Outlined' },
];

/** The colour panel: accent, sidebar colour and the finish of cards, one under another with the same kind of heading. */
function Colours() {
	const { sidebar, cards, setAppearance } = useTheme();
	return (
		<div className="acolours">
			<section className="acolours__sec" aria-label="Accent colour">
				<b className="acolours__title">Accent</b>
				<AccentPicker />
			</section>
			<section className="acolours__sec" aria-label="Sidebar colour">
				<b className="acolours__title">Sidebar (its icons and text turn light or dark by themselves)</b>
			<div className="swatches" role="radiogroup" aria-label="Sidebar colour">
				<button type="button" role="radio" aria-checked={!sidebar} className="swatch swatch--theme" onClick={() => setAppearance({ sidebar: '' })} title="The theme's own sidebar">
					<Icon name="palette" size={16} />
					<span className="sr-only">Theme default</span>
				</button>
				{SIDEBAR_PRESETS.map((c) => (
					<button key={c} type="button" role="radio" aria-checked={sidebar === c} className="swatch" style={{ '--swatch': c }} onClick={() => setAppearance({ sidebar: c })} title={c}>
						{sidebar === c ? <Icon name="check" size={16} /> : null}
						<span className="sr-only">{c}</span>
					</button>
				))}
				<label className="swatch swatch--custom" title="Any colour">
					<Icon name="plus" size={16} />
					<input type="color" aria-label="Pick a custom sidebar colour" value={isHex(sidebar) ? sidebar : '#1f2937'} onChange={(e) => setAppearance({ sidebar: e.target.value })} />
				</label>
			</div>
			<Button variant="ghost" icon="refresh" disabled={!sidebar} onClick={() => setAppearance({ sidebar: '' })}>
				Use the theme's sidebar
			</Button>
			</section>
			<section className="acolours__sec" aria-label="Cards">
				<b className="acolours__title">Cards</b>
				<OptionGroup label="Card finish" options={CARD_FINISH} value={cards} onChange={(v) => setAppearance({ cards: v })} />
			</section>
		</div>
	);
}

function Group({ title, children }) {
	return (
		<div className="agroup">
			<b className="agroup__title">{title}</b>
			{children}
		</div>
	);
}

export default function AppearanceStudio() {
	const { radius, textSize, motion, density, width, setAppearance, setDensity } = useTheme();
	const [tab, setTab] = useState('theme');
	const onKey = (e) => {
		const i = GROUPS.findIndex((g) => g.id === tab);
		const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
		if (!d) return;
		e.preventDefault();
		const next = GROUPS[(i + d + GROUPS.length) % GROUPS.length];
		setTab(next.id);
		const el = document.getElementById(`atab-${next.id}`);
		if (el) el.focus();
	};
	return (
		<div className="atabs">
			<div className="atabs__strip" role="tablist" aria-label="Appearance" onKeyDown={onKey}>
				{GROUPS.map((g) => (
					<button key={g.id} id={`atab-${g.id}`} type="button" role="tab" aria-selected={tab === g.id} aria-controls="atab-panel" tabIndex={tab === g.id ? 0 : -1} className="atabs__tab" onClick={() => setTab(g.id)}>
						<Icon name={g.icon} size={18} />
						<span>{g.label}</span>
					</button>
				))}
			</div>
			<div className="atabs__panel" id="atab-panel" role="tabpanel" aria-labelledby={`atab-${tab}`}>
				{tab === 'theme' ? <ThemeSelector /> : null}
				{tab === 'colours' ? <Colours /> : null}
				{tab === 'style' ? <TemplatePicker /> : null}
				{tab === 'font' ? <FontPicker /> : null}
				{tab === 'charts' ? <PalettePicker /> : null}
				{tab === 'layout' ? (
					<div className="agroups">
						<Group title="Corners">
							<OptionGroup label="Corner style" options={RADII} value={radius} onChange={(v) => setAppearance({ radius: v })} />
						</Group>
						<Group title="Text size">
							<OptionGroup label="Text size" options={TEXT_SIZES} value={textSize} onChange={(v) => setAppearance({ textSize: v })} />
						</Group>
						<Group title="Motion">
							<OptionGroup label="Motion" options={MOTIONS} value={motion} onChange={(v) => setAppearance({ motion: v })} />
						</Group>
						<Group title="Density">
							<OptionGroup label="Density" options={DENSITIES} value={density} onChange={setDensity} />
						</Group>
						<Group title="Page width">
							<OptionGroup label="Page width" options={WIDTHS} value={width} onChange={(v) => setAppearance({ width: v })} />
						</Group>
					</div>
				) : null}
				{tab === 'icons' ? <IconStyleSelector /> : null}
			</div>
		</div>
	);
}
