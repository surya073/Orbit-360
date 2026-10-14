import React, { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/common/Icon';
import CellEditor from './CellEditor';
import { columnLetter, displayText, parseTsv, toTsv } from './gridModel';

const WIDTHS = { text: 240, str: 170, enum: 130, bool: 90, date: 120, datetime: 170, int: 110, num: 110, id: 190 };
const MIN_WIDTH = 60;
const MAX_PASTE_ROWS = 500;
const defaultWidth = (c) => (c.fk ? 200 : WIDTHS[c.type] || 160);

const Row = memo(function Row({ row, r, columns, labelOf, c0, c1, activeC, editingC, readOnly, handlers }) {
	return (
		<div role="row" aria-rowindex={r + 2} className={`sheet__row ${row.isNew ? 'is-new' : ''} ${r % 2 ? 'is-odd' : ''}`.trim()}>
			<div role="rowheader" className={`sheet__gutter ${c0 === 0 && c1 === columns.length - 1 ? 'is-selected' : ''}`.trim()} title={row.isNew ? 'New, unsaved record' : `Record ${row.id}`} onMouseDown={(e) => handlers.rowHeader(r, e)}>
				{row.number}
				{row.isNew ? <i className="sheet__newdot" aria-label="New row" /> : null}
				{row.rowError ? <i className="sheet__rowerr" role="img" aria-label={row.rowError} title={row.rowError} /> : null}
			</div>
			{columns.map((col, c) => {
				const selected = c >= c0 && c <= c1 && c0 !== -1;
				const active = c === activeC;
				const dirty = row.dirty[col.field];
				const error = row.errors[col.field];
				const locked = readOnly || (!row.isNew && col.immutable);
				const cls = ['sheet__cell', selected && 'is-selected', active && 'is-active', dirty && 'is-dirty', error && 'has-error', locked && 'is-locked', col.type === 'int' || col.type === 'num' ? 'is-num' : ''].filter(Boolean).join(' ');
				const text = displayText(col, row.values[col.field], labelOf);
				return (
					<div
						key={col.field}
						id={handlers.cellId(r, c)}
						role="gridcell"
						aria-colindex={c + 2}
						aria-selected={selected || undefined}
						aria-readonly={locked || undefined}
						aria-invalid={error ? true : undefined}
						className={cls}
						style={{ width: `var(--col-${c})` }}
						title={error || undefined}
						onMouseDown={(e) => handlers.cellDown(r, c, e)}
						onMouseEnter={() => handlers.cellEnter(r, c)}
						onDoubleClick={() => handlers.cellEdit(r, c)}
					>
						{editingC === c ? (
							<CellEditor col={col} initial={row.values[col.field] ?? ''} onCommit={(t, nav) => handlers.commit(r, c, t, nav)} onCancel={handlers.cancel} />
						) : (
							<span className="sheet__text">{text}</span>
						)}
					</div>
				);
			})}
		</div>
	);
});

/**
 * Spreadsheet grid: column letters, name headers (sortable, resizable), sticky row numbers,
 * range selection, keyboard navigation, in-cell editing and clipboard. It owns only presentation
 * state (selection, editing, widths); every change goes out through onSetCells.
 *
 * Keyboard (grid focused): arrows move, Shift+arrows extend, Tab/Shift+Tab, Enter or F2 or typing
 * to edit, Delete clears, Ctrl+C / Ctrl+V copy and paste tab-separated text, Ctrl+Z / Ctrl+Y undo
 * and redo, Ctrl+A selects all. While a cell is being edited the editor owns the keyboard.
 */
export default function SheetGrid({ columns, rows, labelOf, readOnly, canAddRows, onSetCells, onAddRows, onNotice, onUndo, onRedo, sort, onSort, onSelectRows, label }) {
	const uid = useId().replace(/:/g, '');
	const scrollRef = useRef(null);
	const gridRef = useRef(null);
	const [sel, setSel] = useState({ r0: 0, c0: 0, r1: 0, c1: 0 }); // anchor (r0,c0) -> focus (r1,c1)
	const [editing, setEditing] = useState(null); // { r, c }
	const [widths, setWidths] = useState({});
	const dragging = useRef(false);

	const rowCount = rows.length;
	const colCount = columns.length;
	const widthOf = (c) => widths[columns[c].field] || defaultWidth(columns[c]);
	const cssVars = useMemo(() => Object.fromEntries(columns.map((c, i) => [`--col-${i}`, `${widths[c.field] || defaultWidth(c)}px`])), [columns, widths]);
	const gridWidth = columns.reduce((n, c) => n + (widths[c.field] || defaultWidth(c)), 0) + 56;

	// Keep a ref of the latest props/state so handlers stay referentially stable (rows are memoised).
	const live = useRef({});
	live.current = { rows, columns, sel, editing, readOnly, canAddRows, onSetCells, onAddRows, onNotice, labelOf };

	// Clamp the selection if the data shrinks (filtering, paging, deleting).
	useEffect(() => {
		setSel((s) => {
			const mr = Math.max(rowCount - 1, 0);
			const mc = Math.max(colCount - 1, 0);
			const n = { r0: Math.min(s.r0, mr), r1: Math.min(s.r1, mr), c0: Math.min(s.c0, mc), c1: Math.min(s.c1, mc) };
			return n.r0 === s.r0 && n.r1 === s.r1 && n.c0 === s.c0 && n.c1 === s.c1 ? s : n;
		});
		setEditing((e) => (e && (e.r >= rowCount || e.c >= colCount) ? null : e));
	}, [rowCount, colCount]);

	// Report which rows are selected (by stable record key) for toolbar actions like Delete.
	const lastKeys = useRef('');
	useEffect(() => {
		if (!onSelectRows) return;
		const keys = rows.slice(Math.min(sel.r0, sel.r1), Math.max(sel.r0, sel.r1) + 1).map((r) => r.key);
		const joined = keys.join('|');
		if (joined !== lastKeys.current) {
			lastKeys.current = joined;
			onSelectRows(keys);
		}
	}, [sel, rows, onSelectRows]);

	const cellId = useCallback((r, c) => `${uid}-${r}-${c}`, [uid]);
	const activeId = rowCount && colCount ? cellId(sel.r1, sel.c1) : undefined;

	// Scroll the active cell into view (sticky header/gutter are accounted for by CSS scroll-padding).
	useLayoutEffect(() => {
		if (!activeId) return;
		const el = document.getElementById(activeId);
		if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}, [activeId]);

	const focusGrid = useCallback(() => {
		if (gridRef.current) gridRef.current.focus({ preventScroll: true });
	}, []);

	const clampR = (r) => Math.max(0, Math.min(r, Math.max(rowCount - 1, 0)));
	const clampC = (c) => Math.max(0, Math.min(c, Math.max(colCount - 1, 0)));
	const moveTo = (r, c, extend) => setSel((s) => (extend ? { ...s, r1: clampR(r), c1: clampC(c) } : { r0: clampR(r), c0: clampC(c), r1: clampR(r), c1: clampC(c) }));

	const isLocked = (r, c) => {
		const { rows: rs, columns: cs, readOnly: ro } = live.current;
		return ro || !rs[r] || (!rs[r].isNew && cs[c].immutable);
	};
	const startEdit = (r, c, initial) => {
		if (isLocked(r, c)) {
			const { rows: rs, columns: cs } = live.current;
			if (rs[r] && !rs[r].isNew && cs[c] && cs[c].immutable) live.current.onNotice(`${cs[c].label} cannot be changed after the record is created.`);
			return;
		}
		setSel({ r0: r, c0: c, r1: r, c1: c });
		setEditing({ r, c, initial });
	};

	// ---- handlers shared by memoised rows -----------------------------------------------------
	const handlers = useMemo(
		() => ({
			cellId,
			cellDown: (r, c, e) => {
				if (e.button !== 0 || (e.target.closest && e.target.closest('.sheet-editor'))) return;
				const ed = live.current.editing;
				if (ed && (ed.r !== r || ed.c !== c)) return; // blur commits the open editor first
				if (ed) return;
				dragging.current = true;
				setSel((s) => (e.shiftKey ? { ...s, r1: r, c1: c } : { r0: r, c0: c, r1: r, c1: c })); // the grid is the focusable ancestor, so the click focuses it natively
			},
			cellEnter: (r, c) => {
				if (dragging.current) setSel((s) => (s.r1 === r && s.c1 === c ? s : { ...s, r1: r, c1: c }));
			},
			cellEdit: (r, c) => {
				const row = live.current.rows[r];
				startEdit(r, c, row ? row.values[live.current.columns[c].field] ?? '' : '');
			},
			rowHeader: (r, e) => {
				if (e.button !== 0) return;
				dragging.current = true;
				const last = live.current.columns.length - 1;
				setSel((s) => (e.shiftKey ? { ...s, r1: r, c0: 0, c1: last } : { r0: r, c0: 0, r1: r, c1: last }));
			},
			commit: (r, c, text, nav) => {
				const { rows: rs, columns: cs, onSetCells: set, onNotice: notice } = live.current;
				setEditing(null);
				const row = rs[r];
				if (row) {
					const { rejected } = set([{ key: row.key, field: cs[c].field, text }]);
					if (rejected.length) notice(rejected[0].reason);
				}
				if (nav === 'down') moveTo(r + 1, c, false);
				else if (nav === 'right') moveTo(r, c + 1, false);
				else if (nav === 'left') moveTo(r, c - 1, false);
				requestAnimationFrame(focusGrid);
			},
			cancel: () => {
				setEditing(null);
				requestAnimationFrame(focusGrid);
			},
		}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[cellId, focusGrid, rowCount, colCount]
	);

	useEffect(() => {
		const up = () => {
			dragging.current = false;
		};
		window.addEventListener('mouseup', up);
		return () => window.removeEventListener('mouseup', up);
	}, []);

	// ---- selection helpers --------------------------------------------------------------------
	const bounds = () => ({ ra: Math.min(sel.r0, sel.r1), rb: Math.max(sel.r0, sel.r1), ca: Math.min(sel.c0, sel.c1), cb: Math.max(sel.c0, sel.c1) });

	const clearSelection = () => {
		const { ra, rb, ca, cb } = bounds();
		const changes = [];
		for (let r = ra; r <= rb; r++) for (let c = ca; c <= cb; c++) if (rows[r] && !isLocked(r, c)) changes.push({ key: rows[r].key, field: columns[c].field, text: '' });
		if (!changes.length) return;
		const { rejected, applied } = onSetCells(changes);
		if (rejected.length) onNotice(`${rejected.length} cell${rejected.length > 1 ? 's' : ''} not cleared. ${rejected[0].reason}`);
		else if (!applied) onNotice('Nothing to clear.');
	};

	const onCopy = (e) => {
		if (editing || !rowCount) return;
		const { ra, rb, ca, cb } = bounds();
		const matrix = [];
		for (let r = ra; r <= rb; r++) {
			const line = [];
			for (let c = ca; c <= cb; c++) line.push(displayForCopy(rows[r], columns[c]));
			matrix.push(line);
		}
		e.clipboardData.setData('text/plain', toTsv(matrix));
		e.preventDefault();
		onNotice(`Copied ${(rb - ra + 1) * (cb - ca + 1)} cell${(rb - ra + 1) * (cb - ca + 1) > 1 ? 's' : ''}`, 'info');
	};
	// Values are copied as the stored text (ids for foreign keys) so they paste back losslessly.
	const displayForCopy = (row, col) => (row ? String(row.values[col.field] ?? '') : '');

	const onPaste = (e) => {
		if (editing) return;
		e.preventDefault();
		if (readOnly) return onNotice('This sheet is read-only.');
		// Plain text only: HTML on the clipboard is never read, so markup cannot be injected.
		const text = e.clipboardData.getData('text/plain');
		if (!text) return;
		const matrix = parseTsv(text);
		if (!matrix.length) return;
		if (matrix.length > MAX_PASTE_ROWS) return onNotice(`Paste at most ${MAX_PASTE_ROWS} rows at a time.`);
		const { ra, rb, ca, cb } = bounds();
		const single = matrix.length === 1 && matrix[0].length === 1;
		const targets = [];
		if (single && (rb > ra || cb > ca)) {
			for (let r = ra; r <= rb; r++) for (let c = ca; c <= cb; c++) targets.push([r, c, matrix[0][0]]);
		} else {
			matrix.forEach((line, i) => line.forEach((cell, j) => targets.push([ra + i, ca + j, cell])));
		}
		const needRows = Math.max(...targets.map((t) => t[0])) + 1 - rowCount;
		let keys = rows.map((r) => r.key);
		if (needRows > 0) {
			if (!canAddRows) onNotice('Rows below the last one were skipped (adding rows is not available here).');
			else keys = [...keys, ...onAddRows(needRows)];
		}
		const changes = [];
		let skippedCols = 0;
		for (const [r, c, text2] of targets) {
			if (c >= colCount) {
				skippedCols++;
				continue;
			}
			if (r >= keys.length) continue;
			changes.push({ key: keys[r], field: columns[c].field, text: text2 });
		}
		const { applied, rejected } = onSetCells(changes);
		const extra = skippedCols ? ` ${skippedCols} value${skippedCols > 1 ? 's' : ''} fell outside the last column and were ignored.` : '';
		if (rejected.length) onNotice(`Pasted ${applied} cell${applied === 1 ? '' : 's'}; ${rejected.length} skipped. ${rejected[0].reason}${extra}`);
		else onNotice(`Pasted ${applied} cell${applied === 1 ? '' : 's'}.${extra}`, 'info');
	};

	// ---- keyboard -----------------------------------------------------------------------------
	const onKeyDown = (e) => {
		if (editing || e.target !== gridRef.current || !rowCount) return;
		const mod = e.ctrlKey || e.metaKey;
		const { r1, c1 } = sel;
		const go = (r, c) => {
			e.preventDefault();
			moveTo(r, c, e.shiftKey);
		};
		switch (e.key) {
			case 'ArrowDown':
				return go(mod ? rowCount - 1 : r1 + 1, c1);
			case 'ArrowUp':
				return go(mod ? 0 : r1 - 1, c1);
			case 'ArrowRight':
				return go(r1, mod ? colCount - 1 : c1 + 1);
			case 'ArrowLeft':
				return go(r1, mod ? 0 : c1 - 1);
			case 'Home':
				return go(mod ? 0 : r1, 0);
			case 'End':
				return go(mod ? rowCount - 1 : r1, colCount - 1);
			case 'PageDown':
				return go(r1 + 10, c1);
			case 'PageUp':
				return go(r1 - 10, c1);
			case 'Tab': {
				e.preventDefault();
				const next = e.shiftKey ? (c1 === 0 ? [r1 - 1, colCount - 1] : [r1, c1 - 1]) : c1 === colCount - 1 ? [r1 + 1, 0] : [r1, c1 + 1];
				return moveTo(clampR(next[0]), clampC(next[1]), false);
			}
			case 'Enter':
				e.preventDefault();
				return startEdit(r1, c1, rows[r1].values[columns[c1].field] ?? '');
			case 'F2':
				e.preventDefault();
				return startEdit(r1, c1, rows[r1].values[columns[c1].field] ?? '');
			case 'Delete':
			case 'Backspace':
				e.preventDefault();
				return clearSelection();
			case 'Escape':
				return moveTo(r1, c1, false);
			default:
		}
		if (mod && e.key.toLowerCase() === 'a') {
			e.preventDefault();
			return setSel({ r0: 0, c0: 0, r1: rowCount - 1, c1: colCount - 1 });
		}
		if (mod && e.key.toLowerCase() === 'z') {
			e.preventDefault();
			return e.shiftKey ? onRedo() : onUndo();
		}
		if (mod && e.key.toLowerCase() === 'y') {
			e.preventDefault();
			return onRedo();
		}
		if (!mod && !e.altKey && e.key.length === 1) {
			e.preventDefault();
			const c = columns[c1];
			const picker = c.fk || c.type === 'enum' || c.type === 'bool';
			startEdit(r1, c1, picker ? rows[r1].values[c.field] ?? '' : e.key); // typing replaces the text, like a spreadsheet
		}
	};

	// ---- column resize ------------------------------------------------------------------------
	const startResize = (c, e) => {
		e.preventDefault();
		e.stopPropagation();
		const startX = e.clientX;
		const startW = widthOf(c);
		const node = scrollRef.current;
		const move = (ev) => {
			const w = Math.max(MIN_WIDTH, Math.round(startW + ev.clientX - startX));
			if (node) node.style.setProperty(`--col-${c}`, `${w}px`);
		};
		const up = (ev) => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			const w = Math.max(MIN_WIDTH, Math.round(startW + ev.clientX - startX));
			setWidths((prev) => ({ ...prev, [columns[c].field]: w }));
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
	};
	const resizeByKey = (c, e) => {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		e.preventDefault();
		const w = Math.max(MIN_WIDTH, widthOf(c) + (e.key === 'ArrowRight' ? 20 : -20));
		setWidths((prev) => ({ ...prev, [columns[c].field]: w }));
	};

	const { ra, rb, ca, cb } = bounds();
	const selectColumn = (c, e) => {
		if (e.target.closest('.sheet__sort') || e.target.closest('.sheet__resize')) return;
		setSel((s) => (e.shiftKey ? { ...s, r1: Math.max(rowCount - 1, 0), c1: c } : { r0: 0, c0: c, r1: Math.max(rowCount - 1, 0), c1: c }));
		focusGrid();
	};

	return (
		<div className="sheet__scroll" ref={scrollRef} style={cssVars}>
			<div
				ref={gridRef}
				className="sheet__grid"
				role="grid"
				tabIndex={0}
				aria-label={label}
				aria-rowcount={rowCount + 1}
				aria-colcount={colCount + 1}
				aria-multiselectable="true"
				aria-activedescendant={activeId}
				aria-readonly={readOnly || undefined}
				style={{ minWidth: gridWidth }}
				onKeyDown={onKeyDown}
				onCopy={onCopy}
				onPaste={onPaste}
			>
				<div role="row" aria-rowindex={1} className="sheet__head">
					<div role="columnheader" className="sheet__corner" aria-label="Row numbers" />
					{columns.map((col, c) => {
						const dir = sort && sort.field === col.field ? sort.dir : null;
						const inSel = c >= ca && c <= cb;
						return (
							<div key={col.field} role="columnheader" aria-colindex={c + 2} aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={`sheet__col ${inSel ? 'is-selected' : ''}`.trim()} style={{ width: `var(--col-${c})` }} onMouseDown={(e) => selectColumn(c, e)}>
								<span className="sheet__letter" aria-hidden="true">
									{columnLetter(c)}
								</span>
								<span className="sheet__name" title={col.label + (col.required ? ' (required)' : '')}>
									{col.label}
									{col.required ? <span className="sheet__req" aria-hidden="true"> *</span> : null}
								</span>
								<button type="button" className={`sheet__sort ${dir ? 'is-on' : ''}`} aria-label={`Sort by ${col.label}${dir ? `, currently ${dir === 'asc' ? 'ascending' : 'descending'}` : ''}`} onClick={() => onSort(col.field)}>
									<Icon name="chevronDown" size={12} className={dir === 'asc' ? 'sheet__flip' : ''} />
								</button>
								<span className="sheet__resize" role="separator" aria-orientation="vertical" aria-label={`Resize ${col.label} column`} tabIndex={-1} onPointerDown={(e) => startResize(c, e)} onKeyDown={(e) => resizeByKey(c, e)} />
							</div>
						);
					})}
				</div>
				{rows.map((row, r) => {
					const inRows = r >= ra && r <= rb;
					return (
						<Row
							key={row.key}
							row={row}
							r={r}
							columns={columns}
							labelOf={labelOf}
							c0={inRows ? ca : -1}
							c1={inRows ? cb : -1}
							activeC={r === sel.r1 ? sel.c1 : -1}
							editingC={editing && editing.r === r ? editing.c : -1}
							readOnly={readOnly}
							handlers={handlers}
						/>
					);
				})}
			</div>
		</div>
	);
}
