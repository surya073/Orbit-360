import React, { useState } from 'react';
import Button from '../../components/common/Button';
import Popover from '../../components/common/Popover';
import Icon from '../../components/common/Icon';
import Select from '../../components/forms/Select';
import SheetGlyph from './SheetGlyph';
import { FilterPanel, MOD } from './SheetToolbar';
import { FILL_COLORS, TEXT_COLORS, ZOOM_STEPS, isHexColor, resolveFill, resolveText } from './sheetFormat';

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

const VIEWS_MAX = 20;
const viewsKey = (resource) => `company360.sheetViews.${resource}`;
function loadViews(resource) {
	try {
		const raw = JSON.parse(window.localStorage.getItem(viewsKey(resource)) || '[]');
		if (!Array.isArray(raw)) return [];
		return raw
			.filter((v) => v && typeof v.name === 'string' && Array.isArray(v.filters))
			.map((v) => ({ name: v.name.slice(0, 40), filters: v.filters.filter((f) => f && typeof f.field === 'string' && typeof f.op === 'string' && typeof f.value === 'string') }))
			.slice(0, VIEWS_MAX);
	} catch {
		return [];
	}
}

/** Saved filter sets for one record type, remembered on this device. */
function FilterViews({ resource, columns, filters, onFilters, close }) {
	const [views, setViews] = useState(() => loadViews(resource));
	const [name, setName] = useState('');
	const persist = (next) => {
		setViews(next);
		try {
			window.localStorage.setItem(viewsKey(resource), JSON.stringify(next));
		} catch {
			/* the view just is not remembered */
		}
	};
	const fields = new Set(columns.map((c) => c.field));
	const save = (e) => {
		e.preventDefault();
		const n = name.trim().slice(0, 40);
		if (!n || !filters.length) return;
		persist([...views.filter((v) => v.name !== n), { name: n, filters }].slice(-VIEWS_MAX));
		setName('');
	};
	return (
		<div className="sheet-filter">
			<span className="small muted">Filter views</span>
			{views.length ? (
				<ul className="sheet-filter__list" aria-label="Saved filter views">
					{views.map((v) => (
						<li key={v.name}>
							<button
								type="button"
								className="menu-item"
								onClick={() => {
									onFilters(v.filters.filter((f) => fields.has(f.field)));
									close();
								}}
							>
								{v.name}
							</button>
							<button type="button" className="icon-btn" aria-label={`Delete view ${v.name}`} onClick={() => persist(views.filter((x) => x.name !== v.name))}>
								<Icon name="x" size={13} />
							</button>
						</li>
					))}
				</ul>
			) : (
				<p className="small muted">No saved views yet. Add a filter, then save it here.</p>
			)}
			<form className="sheet-filter__row" onSubmit={save}>
				<span>Save the current filters as</span>
				<input value={name} maxLength={40} placeholder={filters.length ? 'View name' : 'Add a filter first'} disabled={!filters.length} onChange={(e) => setName(e.target.value)} />
				<Button type="submit" size="sm" variant="primary" disabled={!filters.length || !name.trim()}>
					Save view
				</Button>
			</form>
			{filters.length ? (
				<Button size="sm" onClick={() => onFilters([])}>
					Clear filters
				</Button>
			) : null}
		</div>
	);
}

/** One toolbar button: flat, round on hover, accent when on. */
function Tool({ label, hint, on, disabled, onClick, caret, title, children, ...rest }) {
	return (
		<button type="button" className={`gtool ${on ? 'is-on' : ''}`.trim()} aria-label={label} aria-pressed={on === undefined ? undefined : Boolean(on)} title={title || (hint ? `${label} (${hint})` : label)} disabled={disabled} onClick={onClick} {...rest}>
			{children}
			{caret ? <SheetGlyph name="caret" size={14} /> : null}
		</button>
	);
}

const Sep = () => <span className="gtool-sep" aria-hidden="true" />;

/** A tool that opens a small menu of choices. */
function MenuTool({ label, glyph, disabled, children, active }) {
	return (
		<Popover
			label={label}
			align="left"
			trigger={({ toggle, props }) => (
				<Tool label={label} disabled={disabled} caret on={active} onClick={toggle} {...props}>
					{glyph}
				</Tool>
			)}
		>
			{({ close }) => <div className="sheet-menu-list">{children(close)}</div>}
		</Popover>
	);
}

const Choice = ({ on, onClick, children }) => (
	<button type="button" role="menuitemradio" aria-checked={Boolean(on)} className={`menu-item ${on ? 'is-on' : ''}`.trim()} onClick={onClick}>
		{children}
	</button>
);


const alignGlyph = { left: 'alignLeft', center: 'alignCenter', right: 'alignRight' };
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const WRAP_CHOICES = [
	['overflow', 'Overflow', { wrap: null, clip: null }],
	['wrap', 'Wrap', { wrap: true, clip: null }],
	['clip', 'Clip', { wrap: null, clip: true }],
];
const FUNCTIONS = ['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN'];

/**
 * The spreadsheet tool row, laid out like Google Sheets' toolbar. Every tool either works or is
 * disabled with the reason in its tooltip. Cell formatting is presentation-only and stays on this
 * device: it is never part of a record and never sent to the API.
 */
export default function SheetFormatBar({ resource, fmt, hasSelection, canWrite, canUndo, canRedo, onUndo, onRedo, onSearch, onPrint, painting, onPaint, onSet, onToggle, onClearFormat, onDecimals, onBorders, onFunction, columns, filters, onFilters, zoomPct, onZoom, collapsed, onCollapse }) {
	const pressed = (prop) => Boolean(fmt && fmt[prop]);
	const off = !hasSelection;
	const align = (fmt && fmt.align) || 'left';
	const wrapMode = fmt && fmt.wrap ? 'wrap' : fmt && fmt.clip ? 'clip' : 'overflow';

	if (collapsed)
		return (
			<div className="sheet-tools sheet-tools--collapsed" role="toolbar" aria-label="Spreadsheet tools">
				<Tool label="Show the toolbar" onClick={() => onCollapse(false)}>
					<span className="gtool-flip">
						<SheetGlyph name="chevUp" />
					</span>
				</Tool>
			</div>
		);

	return (
		<div className="sheet-tools" role="toolbar" aria-label="Spreadsheet tools">
			{canWrite ? (
				<>
					<Tool label="Undo" hint={`${MOD}Z`} disabled={!canUndo} onClick={onUndo}>
						<Icon name="undo" size={18} />
					</Tool>
					<Tool label="Redo" hint={`${MOD}Y`} disabled={!canRedo} onClick={onRedo}>
						<Icon name="redo" size={18} />
					</Tool>
				</>
			) : null}
			<Select className="gtool-select gtool-select--zoom" aria-label="Zoom" value={String(zoomPct)} onChange={(e) => onZoom(Number(e.target.value))} title="Zoom (or Ctrl+mouse wheel over the grid)">
				{ZOOM_STEPS.map((z) => (
					<option key={z} value={z}>
						{z}%
					</option>
				))}
			</Select>

			<Sep />
			<Tool label="Bold" hint={`${MOD}B`} on={pressed('b')} disabled={off} onClick={() => onToggle('b')}>
				<span className="gtool-text gtool-text--b">B</span>
			</Tool>
			<Tool label="Italic" hint={`${MOD}I`} on={pressed('i')} disabled={off} onClick={() => onToggle('i')}>
				<span className="gtool-text gtool-text--i">I</span>
			</Tool>
			<Popover
				label="Text colour"
				align="left"
				trigger={({ toggle, props }) => (
					<Tool label="Text colour" disabled={off} onClick={toggle} {...props}>
						<span className="sheet-format__glyph" style={{ borderBottomColor: fmt && fmt.color && resolveText(fmt.color) ? resolveText(fmt.color).css : 'var(--text)' }}>
							A
						</span>
					</Tool>
				)}
			>
				{({ close }) => <Swatches label="Text colour" colors={TEXT_COLORS} current={fmt && fmt.color} onPick={(id) => onSet({ color: id })} onClear={() => onSet({ color: null })} close={close} />}
			</Popover>
			<Popover
				label="Fill colour"
				align="left"
				trigger={({ toggle, props }) => (
					<Tool label="Fill colour" disabled={off} onClick={toggle} {...props}>
						<Icon name="fill" size={18} />
						<span className="sheet-format__bar" style={{ background: fmt && fmt.fill && resolveFill(fmt.fill) ? resolveFill(fmt.fill).css : 'transparent' }} aria-hidden="true" />
					</Tool>
				)}
			>
				{({ close }) => <Swatches label="Fill colour" colors={FILL_COLORS} current={fmt && fmt.fill} onPick={(id) => onSet({ fill: id })} onClear={() => onSet({ fill: null })} close={close} />}
			</Popover>

			<Sep />
			<MenuTool label="Horizontal align" glyph={<SheetGlyph name={alignGlyph[align]} />} disabled={off}>
				{(close) =>
					Object.keys(alignGlyph).map((a) => (
						<Choice
							key={a}
							on={align === a}
							onClick={() => {
								onSet({ align: a === 'left' ? null : a });
								close();
							}}
						>
							<SheetGlyph name={alignGlyph[a]} size={16} />
							<span>{cap(a)}</span>
						</Choice>
					))
				}
			</MenuTool>
			<MenuTool label="Text wrapping" glyph={<SheetGlyph name="wrap" />} disabled={off}>
				{(close) =>
					WRAP_CHOICES.map(([id, label, patch]) => (
						<Choice
							key={id}
							on={wrapMode === id}
							onClick={() => {
								onSet(patch);
								close();
							}}
						>
							{label}
						</Choice>
					))
				}
			</MenuTool>
			<Sep />
			<Popover
				label="Filter rows"
				align="left"
				trigger={({ toggle, props }) => (
					<Tool label="Filter rows" on={filters.length > 0} onClick={toggle} {...props}>
						<Icon name="filter" size={18} />
						{filters.length ? <span className="gtool-count">{filters.length}</span> : null}
					</Tool>
				)}
			>
				<FilterPanel columns={columns} filters={filters} onChange={onFilters} />
			</Popover>
			<Popover
				label="Filter views"
				align="left"
				trigger={({ toggle, props }) => (
					<Tool label="Filter views" caret onClick={toggle} {...props}>
						<SheetGlyph name="views" />
					</Tool>
				)}
			>
				{({ close }) => <FilterViews resource={resource} columns={columns} filters={filters} onFilters={onFilters} close={close} />}
			</Popover>
			<MenuTool label="Functions" glyph={<SheetGlyph name="sigma" />} disabled={off}>
				{(close) =>
					FUNCTIONS.map((f) => (
						<button
							key={f}
							type="button"
							className="menu-item"
							onClick={() => {
								onFunction(f.toLowerCase());
								close();
							}}
						>
							{f}
						</button>
					))
				}
			</MenuTool>
			<Tool label="Clear formatting" disabled={off} onClick={onClearFormat} title="Clear formatting of the selected cells">
				<span className="gtool-text gtool-text--sm">Tx</span>
			</Tool>

			<span className="gtool-spacer" />
			<span className="gtool-note small muted" title="The record API has no place for formatting, so it is remembered in this browser only and is never saved to the record.">
				Formatting stays on this device
			</span>
			<Tool label="Hide the toolbar" onClick={() => onCollapse(true)}>
				<SheetGlyph name="chevUp" />
			</Tool>
		</div>
	);
}
