import React, { useState } from 'react';
import Button from '../../components/common/Button';
import Popover from '../../components/common/Popover';
import Icon from '../../components/common/Icon';
import { ALIGNS, FILL_COLORS, FONT_SIZES, TEXT_COLORS, ZOOM_STEPS, isHexColor, resolveFill, resolveText, safeUrl } from './sheetFormat';
import { MOD } from './SheetToolbar';

function Swatches({ label, colors, current, onPick, onClear, close }) {
	// The native colour picker covers any colour; the theme palette above stays one click away.
	const custom = isHexColor(current) ? current : '#4f46e5';
	return (
		<div className="sheet-palette" role="group" aria-label={label}>
			<div className="sheet-palette__grid">
				{colors.map((c) => (
					<button
						key={c.id}
						type="button"
						className={`sheet-palette__swatch ${current === c.id ? 'is-current' : ''}`.trim()}
						style={{ background: c.css }}
						aria-label={`${label}: ${c.label}`}
						aria-pressed={current === c.id}
						title={c.label}
						onClick={() => {
							onPick(c.id);
							close();
						}}
					/>
				))}
			</div>
			<label className="sheet-palette__custom">
				<input type="color" value={custom} aria-label={`${label}: custom colour`} onChange={(e) => onPick(e.target.value.toLowerCase())} />
				<span>Custom colour…</span>
				{isHexColor(current) ? <code>{current}</code> : null}
			</label>
			<Button
				size="sm"
				variant="ghost"
				onClick={() => {
					onClear();
					close();
				}}
			>
				Clear
			</Button>
		</div>
	);
}

function LinkForm({ current, onApply, onRemove, close }) {
	const [url, setUrl] = useState(current || '');
	const [error, setError] = useState('');
	const submit = (e) => {
		e.preventDefault();
		if (url.trim() === '') {
			onRemove();
			return close();
		}
		const ok = safeUrl(url);
		if (!ok) return setError('Enter a web address (http or https) or an email address.');
		onApply(ok);
		close();
	};
	return (
		<form className="sheet-filter" onSubmit={submit}>
			<label className="sheet-filter__row">
				<span>Link address</span>
				<input
					type="text"
					value={url}
					placeholder="https://example.com"
					data-autofocus
					onChange={(e) => {
						setUrl(e.target.value);
						setError('');
					}}
					aria-invalid={error ? true : undefined}
				/>
			</label>
			{error ? (
				<p role="alert" className="small" style={{ color: 'var(--danger)' }}>
					{error}
				</p>
			) : null}
			<p className="small muted">Only http, https and email links are allowed. Ctrl+Click a linked cell to open it.</p>
			<div style={{ display: 'flex', gap: 8 }}>
				<Button type="submit" size="sm" variant="primary">
					Apply link
				</Button>
				{current ? (
					<Button
						size="sm"
						onClick={() => {
							onRemove();
							close();
						}}
					>
						Remove link
					</Button>
				) : null}
			</div>
		</form>
	);
}

/**
 * Formatting row of the spreadsheet: font size, bold, italic, wrap, alignment, text and fill colour,
 * link and zoom. Formatting is presentation-only and stays on this device; it is never part of a record.
 */
export default function SheetFormatBar({ fmt, hasSelection, onSet, onToggle, onClearFormat, zoomPct, onZoom }) {
	const pressed = (prop) => Boolean(fmt && fmt[prop]);
	return (
		<div className="sheet-format" role="toolbar" aria-label="Cell formatting">
			<div className="sheet-toolbar__group" role="group" aria-label="Font">
				<select className="sheet-scope" aria-label="Font size" value={fmt && fmt.size ? String(fmt.size) : ''} disabled={!hasSelection} onChange={(e) => onSet({ size: e.target.value ? Number(e.target.value) : null })}>
					<option value="">Size</option>
					{FONT_SIZES.map((n) => (
						<option key={n} value={n}>
							{n}
						</option>
					))}
				</select>
				<Button size="sm" variant={pressed('b') ? 'secondary' : 'ghost'} aria-pressed={pressed('b')} aria-label="Bold" title={`Bold (${MOD}B)`} disabled={!hasSelection} onClick={() => onToggle('b')}>
					<b>B</b>
				</Button>
				<Button size="sm" variant={pressed('i') ? 'secondary' : 'ghost'} aria-pressed={pressed('i')} aria-label="Italic" title={`Italic (${MOD}I)`} disabled={!hasSelection} onClick={() => onToggle('i')}>
					<i>I</i>
				</Button>
				<Button size="sm" variant={pressed('wrap') ? 'secondary' : 'ghost'} aria-pressed={pressed('wrap')} aria-label="Wrap text" title="Wrap text" disabled={!hasSelection} onClick={() => onToggle('wrap')}>
					Wrap
				</Button>
			</div>

			<div className="sheet-toolbar__group" role="group" aria-label="Horizontal alignment">
				{ALIGNS.map((a) => (
					<Button key={a} size="sm" variant={fmt && fmt.align === a ? 'secondary' : 'ghost'} aria-pressed={Boolean(fmt && fmt.align === a)} aria-label={`Align ${a}`} title={`Align ${a}`} disabled={!hasSelection} onClick={() => onSet({ align: fmt && fmt.align === a ? null : a })}>
						{a === 'left' ? 'Left' : a === 'center' ? 'Center' : 'Right'}
					</Button>
				))}
			</div>

			<div className="sheet-toolbar__group" role="group" aria-label="Colour and link">
				<Popover
					label="Text colour"
					align="left"
					trigger={({ toggle, props }) => (
						<Button size="sm" variant="ghost" disabled={!hasSelection} onClick={toggle} aria-label="Text colour" title="Text colour" {...props}>
							<span className="sheet-format__glyph" style={{ borderBottomColor: (fmt && fmt.color && resolveText(fmt.color) ? resolveText(fmt.color).css : 'var(--text)') }}>
								A
							</span>
						</Button>
					)}
				>
					{({ close }) => <Swatches label="Text colour" colors={TEXT_COLORS} current={fmt && fmt.color} onPick={(id) => onSet({ color: id })} onClear={() => onSet({ color: null })} close={close} />}
				</Popover>
				<Popover
					label="Fill colour"
					align="left"
					trigger={({ toggle, props }) => (
						<Button size="sm" variant="ghost" disabled={!hasSelection} onClick={toggle} aria-label="Fill colour" title="Fill colour" {...props}>
							<Icon name="fill" size={16} />
							<span className="sheet-format__bar" style={{ background: (fmt && fmt.fill && resolveFill(fmt.fill) ? resolveFill(fmt.fill).css : 'transparent') }} aria-hidden="true" />
						</Button>
					)}
				>
					{({ close }) => <Swatches label="Fill colour" colors={FILL_COLORS} current={fmt && fmt.fill} onPick={(id) => onSet({ fill: id })} onClear={() => onSet({ fill: null })} close={close} />}
				</Popover>
				<Popover
					label="Insert link"
					align="left"
					trigger={({ toggle, props }) => (
						<Button size="sm" variant={fmt && fmt.link ? 'secondary' : 'ghost'} disabled={!hasSelection} onClick={toggle} aria-label="Insert link" title="Insert link" {...props}>
							Link
						</Button>
					)}
				>
					{({ close }) => <LinkForm current={fmt && fmt.link} onApply={(url) => onSet({ link: url })} onRemove={() => onSet({ link: null })} close={close} />}
				</Popover>
				<Button size="sm" variant="ghost" disabled={!hasSelection} onClick={onClearFormat} aria-label="Clear formatting" title="Clear formatting of the selected cells">
					Clear format
				</Button>
			</div>

			<div className="sheet-toolbar__spacer" />

			<span className="small muted sheet-format__note" title="The record API has no place for formatting, so it is remembered in this browser only and is never saved to the record.">
				Formatting is saved on this device only, not in the record
			</span>

			<div className="sheet-toolbar__group" role="group" aria-label="Zoom">
				<select className="sheet-scope" aria-label="Zoom" value={String(zoomPct)} onChange={(e) => onZoom(Number(e.target.value))} title="Zoom (or Ctrl+mouse wheel over the grid)">
					{ZOOM_STEPS.map((z) => (
						<option key={z} value={z}>
							{z}%
						</option>
					))}
				</select>
			</div>
		</div>
	);
}
