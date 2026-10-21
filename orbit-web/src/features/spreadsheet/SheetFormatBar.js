import React, { useState } from 'react';
import Button from '../../components/common/Button';
import Popover from '../../components/common/Popover';
import Icon from '../../components/common/Icon';
import Select from '../../components/forms/Select';
import SheetGlyph from './SheetGlyph';
import { FilterPanel, MOD } from './SheetToolbar';
import { DEFAULT_FONT_SIZE, FILL_COLORS, FONT_FAMILIES, FONT_SIZES, MAX_FONT_SIZE, MIN_FONT_SIZE, TEXT_COLORS, ZOOM_STEPS, isHexColor, resolveFill, resolveText, safeUrl } from './sheetFormat';

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

function NoteForm({ current, onApply, onRemove, close }) {
	const [text, setText] = useState(current || '');
	return (
		<form
			className="sheet-filter"
			onSubmit={(e) => {
				e.preventDefault();
				if (text.trim()) onApply(text.trim().slice(0, 500));
				else onRemove();
				close();
			}}
		>
			<label className="sheet-filter__row">
				<span>Note on this cell</span>
				<textarea rows={3} maxLength={500} value={text} data-autofocus onChange={(e) => setText(e.target.value)} />
			</label>
			<p className="small muted">Notes are kept on this device only; they are not part of the record.</p>
			<div style={{ display: 'flex', gap: 8 }}>
				<Button type="submit" size="sm" variant="primary">
					{current ? 'Update note' : 'Add note'}
				</Button>
				{current ? (
					<Button
						size="sm"
						onClick={() => {
							onRemove();
							close();
						}}
					>
						Remove note
					</Button>
				) : null}
			</div>
		</form>
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

const stepSize = (cur, dir) => {
	const next = dir > 0 ? FONT_SIZES.find((n) => n > cur) : [...FONT_SIZES].reverse().find((n) => n < cur);
	return next || Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, cur + dir));
};

function SizeBox({ size, disabled, onSize }) {
	const [draft, setDraft] = useState(null);
	const commit = () => {
		if (draft === null) return;
		const n = Math.round(Number(draft));
		setDraft(null);
		if (Number.isFinite(n) && n >= MIN_FONT_SIZE && n <= MAX_FONT_SIZE) onSize(n);
	};
	return (
		<span className="gtool-size" role="group" aria-label="Font size">
			<Tool label="Decrease font size" disabled={disabled} onClick={() => onSize(stepSize(size, -1))}>
				<SheetGlyph name="minus" size={16} />
			</Tool>
			<input
				className="gtool-size__input"
				inputMode="numeric"
				role="spinbutton"
				aria-valuemin={MIN_FONT_SIZE}
				aria-valuemax={MAX_FONT_SIZE}
				aria-valuenow={size}
				aria-label="Font size"
				value={draft === null ? size : draft}
				disabled={disabled}
				onFocus={(e) => e.target.select()}
				onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
				onBlur={commit}
				onKeyDown={(e) => {
					e.stopPropagation();
					if (e.key === 'Enter') {
						e.preventDefault();
						commit();
					} else if (e.key === 'Escape') setDraft(null);
				}}
			/>
			<Tool label="Increase font size" disabled={disabled} onClick={() => onSize(stepSize(size, 1))}>
				<SheetGlyph name="plus" size={16} />
			</Tool>
		</span>
	);
}

const alignGlyph = { left: 'alignLeft', center: 'alignCenter', right: 'alignRight' };
const valignGlyph = { top: 'valignTop', middle: 'valignMiddle', bottom: 'valignBottom' };
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const NUMBER_CHOICES = [
	{ id: 'auto', label: 'Automatic', nf: null, eg: '' },
	{ id: 'text', label: 'Plain text', nf: { t: 'text' }, eg: '1000.5' },
	{ id: 'number', label: 'Number', nf: { t: 'number' }, eg: '1,000.50' },
	{ id: 'percent', label: 'Percent', nf: { t: 'percent' }, eg: '10.12%' },
	{ id: 'currency', label: 'Currency', nf: { t: 'currency' }, eg: '£1,000.50' },
];
const BORDER_CHOICES = [
	{ id: 'all', label: 'All borders' },
	{ id: 'outer', label: 'Outer borders' },
	{ id: 't', label: 'Top border' },
	{ id: 'b', label: 'Bottom border' },
	{ id: 'l', label: 'Left border' },
	{ id: 'r', label: 'Right border' },
	{ id: 'none', label: 'Clear borders' },
];
const WRAP_CHOICES = [
	['overflow', 'Overflow', { wrap: null, clip: null }],
	['wrap', 'Wrap', { wrap: true, clip: null }],
	['clip', 'Clip', { wrap: null, clip: true }],
];
const FUNCTIONS = ['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN'];
const NO_MERGE = 'Merging cells is not available: every cell is one field of one record.';
const NO_ROTATE = 'Text rotation is not available: rows have a fixed height.';
const NO_CHART = 'Charts are not available in the sheet. Use the dashboard for charts.';

/**
 * The spreadsheet tool row, laid out like Google Sheets' toolbar. Every tool either works or is
 * disabled with the reason in its tooltip. Cell formatting is presentation-only and stays on this
 * device: it is never part of a record and never sent to the API.
 */
export default function SheetFormatBar({ resource, fmt, hasSelection, canWrite, canUndo, canRedo, onUndo, onRedo, onSearch, onPrint, painting, onPaint, onSet, onToggle, onClearFormat, onDecimals, onBorders, onFunction, columns, filters, onFilters, zoomPct, onZoom, collapsed, onCollapse }) {
	const pressed = (prop) => Boolean(fmt && fmt[prop]);
	const off = !hasSelection;
	const nfType = fmt && fmt.nf ? fmt.nf.t : null;
	const align = (fmt && fmt.align) || 'left';
	const valign = (fmt && fmt.valign) || 'bottom';
	const size = (fmt && fmt.size) || DEFAULT_FONT_SIZE;
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
			<Tool label="Search" hint={`${MOD}F`} onClick={onSearch}>
				<Icon name="search" size={18} />
			</Tool>
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
			<Tool label="Print" hint={`${MOD}P`} onClick={onPrint}>
				<SheetGlyph name="print" />
			</Tool>
			<Tool label="Paint format" on={painting} disabled={off} onClick={onPaint} title={painting ? 'Now select the cells to paint the format onto' : 'Paint format: copy this cell’s formatting, then select the cells to apply it to'}>
				<SheetGlyph name="paint" />
			</Tool>
			<Select className="gtool-select gtool-select--zoom" aria-label="Zoom" value={String(zoomPct)} onChange={(e) => onZoom(Number(e.target.value))} title="Zoom (or Ctrl+mouse wheel over the grid)">
				{ZOOM_STEPS.map((z) => (
					<option key={z} value={z}>
						{z}%
					</option>
				))}
			</Select>

			<Sep />
			<Tool label="Format as currency" on={nfType === 'currency'} disabled={off} onClick={() => onSet({ nf: nfType === 'currency' ? null : { t: 'currency' } })}>
				<span className="gtool-text">£</span>
			</Tool>
			<Tool label="Format as percent" on={nfType === 'percent'} disabled={off} onClick={() => onSet({ nf: nfType === 'percent' ? null : { t: 'percent' } })}>
				<span className="gtool-text">%</span>
			</Tool>
			<Tool label="Decrease decimal places" disabled={off} onClick={() => onDecimals(-1)}>
				<span className="gtool-text gtool-text--sm">.0←</span>
			</Tool>
			<Tool label="Increase decimal places" disabled={off} onClick={() => onDecimals(1)}>
				<span className="gtool-text gtool-text--sm">.00→</span>
			</Tool>
			<Popover
				label="More formats"
				align="left"
				trigger={({ toggle, props }) => (
					<Tool label="More formats" disabled={off} on={nfType === 'number' || nfType === 'text'} onClick={toggle} {...props}>
						<span className="gtool-text gtool-text--sm">123</span>
					</Tool>
				)}
			>
				{({ close }) => (
					<div className="sheet-menu-list">
						{NUMBER_CHOICES.map((c) => (
							<Choice
								key={c.id}
								on={c.id === 'auto' ? !nfType : nfType === c.nf.t}
								onClick={() => {
									onSet({ nf: c.nf });
									close();
								}}
							>
								<span>{c.label}</span>
								<small className="muted">{c.eg}</small>
							</Choice>
						))}
					</div>
				)}
			</Popover>

			<Sep />
			<Select className="gtool-select gtool-select--font" aria-label="Font family" disabled={off} value={(fmt && fmt.font) || ''} onChange={(e) => onSet({ font: e.target.value || null })}>
				<option value="">Default</option>
				{FONT_FAMILIES.map((f) => (
					<option key={f.id} value={f.id}>
						{f.label}
					</option>
				))}
			</Select>
			<SizeBox size={size} disabled={off} onSize={(n) => onSet({ size: n })} />

			<Sep />
			<Tool label="Bold" hint={`${MOD}B`} on={pressed('b')} disabled={off} onClick={() => onToggle('b')}>
				<span className="gtool-text gtool-text--b">B</span>
			</Tool>
			<Tool label="Italic" hint={`${MOD}I`} on={pressed('i')} disabled={off} onClick={() => onToggle('i')}>
				<span className="gtool-text gtool-text--i">I</span>
			</Tool>
			<Tool label="Strikethrough" on={pressed('s')} disabled={off} onClick={() => onToggle('s')}>
				<SheetGlyph name="strike" />
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
			<MenuTool label="Borders" glyph={<SheetGlyph name="borders" />} disabled={off} active={Boolean(fmt && fmt.bd)}>
				{(close) =>
					BORDER_CHOICES.map((c) => (
						<button
							key={c.id}
							type="button"
							className="menu-item"
							onClick={() => {
								onBorders(c.id);
								close();
							}}
						>
							{c.label}
						</button>
					))
				}
			</MenuTool>
			<Tool label="Merge cells" disabled title={NO_MERGE}>
				<SheetGlyph name="merge" />
				<SheetGlyph name="caret" size={14} />
			</Tool>

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
			<MenuTool label="Vertical align" glyph={<SheetGlyph name={valignGlyph[valign]} />} disabled={off}>
				{(close) =>
					Object.keys(valignGlyph).map((a) => (
						<Choice
							key={a}
							on={valign === a}
							onClick={() => {
								onSet({ valign: a === 'bottom' ? null : a });
								close();
							}}
						>
							<SheetGlyph name={valignGlyph[a]} size={16} />
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
			<Tool label="Text rotation" disabled title={NO_ROTATE}>
				<SheetGlyph name="rotate" />
				<SheetGlyph name="caret" size={14} />
			</Tool>

			<Sep />
			<Popover
				label="Insert link"
				align="left"
				trigger={({ toggle, props }) => (
					<Tool label="Insert link" on={Boolean(fmt && fmt.link)} disabled={off} onClick={toggle} {...props}>
						<SheetGlyph name="link" />
					</Tool>
				)}
			>
				{({ close }) => <LinkForm current={fmt && fmt.link} onApply={(url) => onSet({ link: url })} onRemove={() => onSet({ link: null })} close={close} />}
			</Popover>
			<Popover
				label="Insert comment"
				align="left"
				trigger={({ toggle, props }) => (
					<Tool label="Insert comment" on={Boolean(fmt && fmt.note)} disabled={off} onClick={toggle} {...props}>
						<SheetGlyph name="comment" />
					</Tool>
				)}
			>
				{({ close }) => <NoteForm current={fmt && fmt.note} onApply={(note) => onSet({ note })} onRemove={() => onSet({ note: null })} close={close} />}
			</Popover>
			<Tool label="Insert chart" disabled title={NO_CHART}>
				<SheetGlyph name="chart" />
			</Tool>
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
