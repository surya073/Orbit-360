import React, { forwardRef, memo, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../components/common/Icon';
import CellEditor from './CellEditor';
import { columnLetter, displayText, jumpTarget, parseTsv, rangeLabel, toTsv } from './gridModel';
import { cellStyle, formatNumberText, linkFor, zoomIn, zoomOut } from './sheetFormat';

const WIDTHS = { text: 240, str: 170, enum: 130, bool: 90, date: 120, datetime: 170, int: 110, num: 110, id: 190 };
const MIN_WIDTH = 60;
const MAX_PASTE_ROWS = 500;
const defaultWidth = (c) => (c.fk ? 200 : WIDTHS[c.type] || 160);
const ROW_HEIGHT = { compact: 28, comfortable: 38 };

const widthsKey = (k) => `company360.sheetWidths.${k}`;
function loadWidths(k) {
	if (!k) return {};
	try {
		const v = JSON.parse(window.localStorage.getItem(widthsKey(k)) || '{}');
		return v && typeof v === 'object' ? v : {};
	} catch {
		return {};
	}
}
function saveWidths(k, w) {
	if (!k) return;
	try {
		window.localStorage.setItem(widthsKey(k), JSON.stringify(w));
	} catch {
		/* storage unavailable: widths just reset next visit */
	}
}

const Row = memo(function Row({ row, r, columns, labelOf, c0, c1, rTop, rBottom, activeC, editingC, editInitial, readOnly, fmt, handlers }) {
	return (
		<div role="row" aria-rowindex={r + 2} className={`sheet__row ${row.isNew ? 'is-new' : ''} ${r % 2 ? 'is-odd' : ''}`.trim()}>
			<div role="rowheader" className={`sheet__gutter ${c0 !== -1 ? 'is-selected' : ''}`.trim()} title={row.isNew ? 'New, unsaved record' : `Record ${row.id}`} onMouseDown={(e) => handlers.rowHeader(r, e)}>
				{row.number}
				{row.isNew ? <i className="sheet__newdot" aria-label="New row" /> : null}
				{row.rowError ? <i className="sheet__rowerr" role="img" aria-label={row.rowError} title={row.rowError} /> : null}
			</div>
			{columns.map((col, c) => {
				const f = fmt && fmt[col.field];
				const selected = c >= c0 && c <= c1 && c0 !== -1;
				const active = c === activeC;
				const dirty = row.dirty[col.field];
				const error = row.errors[col.field];
				const locked = readOnly || (!row.isNew && col.immutable);
				const cls = ['sheet__cell', f && f.wrap && 'is-wrap', f && f.clip && 'is-clip', f && f.note && 'has-note', f && f.fill && 'has-fill', selected && 'is-selected', selected && rTop && 'edge-t', selected && rBottom && 'edge-b', selected && c === c0 && 'edge-l', selected && c === c1 && 'edge-r', active && 'is-active', dirty && 'is-dirty', error && 'has-error', locked && 'is-locked', col.type === 'int' || col.type === 'num' ? 'is-num' : ''].filter(Boolean).join(' ');
				const text = f && f.nf ? formatNumberText(displayText(col, row.values[col.field], labelOf), f.nf) : displayText(col, row.values[col.field], labelOf);
				const shown = text || (f && f.link ? f.link : '');
				const href = linkFor(f, row.values[col.field]);
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
						style={{ width: `calc(var(--col-${c}) * var(--sheet-zoom, 1))`, ...cellStyle(f) }}
						title={error || (f && f.note) || undefined}
						onMouseDown={(e) => handlers.cellDown(r, c, e)}
						onMouseEnter={() => handlers.cellEnter(r, c)}
						onDoubleClick={() => handlers.cellEdit(r, c)}
					>
						{editingC === c ? (
							<CellEditor col={col} initial={editInitial ?? row.values[col.field] ?? ''} onCommit={(t, nav) => handlers.commit(r, c, t, nav)} onCancel={handlers.cancel} />
						) : (
							href ? (
								<a
									className="sheet__text sheet__link"
									href={href}
									target="_blank"
									rel="noopener noreferrer"
									tabIndex={-1}
									title="Ctrl+Click to open the link"
									onClick={(e) => {
										if (!(e.ctrlKey || e.metaKey)) e.preventDefault(); // a plain click only selects the cell
									}}
								>
									{shown}
								</a>
							) : (
								<span className="sheet__text">{shown}</span>
							)
						)}
					</div>
				);
			})}
		</div>
	);
});

/** Right-click menu. Rendered in a portal; closes on outside click, Escape, scroll or choosing an item. */
function ContextMenu({ at, items, onClose }) {
	const ref = useRef(null);
	useEffect(() => {
		const first = ref.current && ref.current.querySelector('button:not([disabled])');
		if (first) first.focus();
		const away = (e) => {
			if (ref.current && !ref.current.contains(e.target)) onClose();
		};
		const key = (e) => {
			if (e.key === 'Escape') onClose();
		};
		document.addEventListener('mousedown', away);
		document.addEventListener('keydown', key);
		window.addEventListener('scroll', onClose, true);
		window.addEventListener('resize', onClose);
		return () => {
			document.removeEventListener('mousedown', away);
			document.removeEventListener('keydown', key);
			window.removeEventListener('scroll', onClose, true);
			window.removeEventListener('resize', onClose);
		};
	}, [onClose]);
	const onKeyDown = (e) => {
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
		const btns = [...ref.current.querySelectorAll('button:not([disabled])')];
		const i = btns.indexOf(document.activeElement);
		e.preventDefault();
		btns[(i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length].focus();
	};
	return (
		<div ref={ref} className="sheet-menu" role="menu" aria-label="Cell actions" style={{ left: at.x, top: at.y }} onKeyDown={onKeyDown}>
			{items.map((it) => (
				<button
					key={it.label}
					type="button"
					role="menuitem"
					className={`sheet-menu__item ${it.danger ? 'is-danger' : ''}`.trim()}
					disabled={it.disabled}
					onClick={() => {
						onClose();
						it.run();
					}}
				>
					<span>{it.label}</span>
					{it.hint ? <kbd>{it.hint}</kbd> : null}
				</button>
			))}
		</div>
	);
}

/**
 * Spreadsheet grid: column letters, name headers (sortable, resizable), sticky row numbers,
 * range selection, keyboard navigation, in-cell editing and clipboard. It owns only presentation
 * state (selection, editing, widths); every change goes out through onSetCells.
 *
 * Keyboard (grid focused): arrows move, Shift+arrows extend, Tab/Shift+Tab, Enter or F2 or typing
 * to edit, Delete clears, Ctrl+C / Ctrl+V copy and paste tab-separated text, Ctrl+Z / Ctrl+Y undo
 * and redo, Ctrl+A selects all. While a cell is being edited the editor owns the keyboard.
 */
const SheetGrid = forwardRef(function SheetGrid({ columns, rows, labelOf, readOnly, canAddRows, onSetCells, onAddRows, onNotice, onUndo, onRedo, sort, onSort, onSelectRows, onSelection, onDeleteRows, density = 'compact', storageKey, label, formats, zoom = 1, onZoom, onFormatShortcut }, ref) {
	const uid = useId().replace(/:/g, '');
	const scrollRef = useRef(null);
	const gridRef = useRef(null);
	const [sel, setSel] = useState({ r0: 0, c0: 0, r1: 0, c1: 0 }); // anchor (r0,c0) -> focus (r1,c1)
	const [editing, setEditing] = useState(null); // { r, c }
	const [widths, setWidths] = useState(() => loadWidths(storageKey));
	const [menu, setMenu] = useState(null); // context menu position
	const dragging = useRef(false);

	useEffect(() => saveWidths(storageKey, widths), [storageKey, widths]);

	const rowCount = rows.length;
	const colCount = columns.length;
	const widthOf = (c) => widths[columns[c].field] || defaultWidth(columns[c]);
	const cssVars = useMemo(() => Object.fromEntries(columns.map((c, i) => [`--col-${i}`, `${widths[c.field] || defaultWidth(c)}px`])), [columns, widths]);
	const gridWidth = (columns.reduce((n, c) => n + (widths[c.field] || defaultWidth(c)), 0) + 56) * zoom;

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

	// Tell the page what is selected (name-box style label, active cell) for its status bar and format toolbar.
	const lastSel = useRef('');
	useEffect(() => {
		if (!onSelection) return;
		const n = (Math.abs(sel.r1 - sel.r0) + 1) * (Math.abs(sel.c1 - sel.c0) + 1);
		const row = rows[sel.r1];
		const col = columns[sel.c1];
		const active = row && col ? { key: row.key, field: col.field } : null;
		const sig = `${rowCount && colCount ? rangeLabel(sel) : ''}|${n}|${active ? `${active.key}|${active.field}` : ''}`;
		if (sig === lastSel.current) return;
		lastSel.current = sig;
		onSelection(rowCount && colCount ? { label: rangeLabel(sel), cells: n, active } : null);
	}, [sel, rows, columns, rowCount, colCount, onSelection]);

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
				else if (nav === 'up') moveTo(r - 1, c, false);
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

	const clearSelection = (fromCut = false) => {
		const { ra, rb, ca, cb } = bounds();
		const changes = [];
		for (let r = ra; r <= rb; r++) for (let c = ca; c <= cb; c++) if (rows[r] && !isLocked(r, c)) changes.push({ key: rows[r].key, field: columns[c].field, text: '' });
		if (!changes.length) return;
		const { rejected, applied } = onSetCells(changes);
		if (rejected.length) onNotice(`${rejected.length} cell${rejected.length > 1 ? 's' : ''} not cleared. ${rejected[0].reason}`);
		else if (!applied && !fromCut) onNotice('Nothing to clear.');
	};

	// Values are copied as the stored text (ids for foreign keys) so they paste back losslessly.
	const displayForCopy = (row, col) => (row ? String(row.values[col.field] ?? '') : '');
	const selectionText = () => {
		const { ra, rb, ca, cb } = bounds();
		const matrix = [];
		for (let r = ra; r <= rb; r++) {
			const line = [];
			for (let c = ca; c <= cb; c++) line.push(displayForCopy(rows[r], columns[c]));
			matrix.push(line);
		}
		return { text: toTsv(matrix), count: (rb - ra + 1) * (cb - ca + 1) };
	};
	const copiedNotice = (verb, count) => onNotice(`${verb} ${count} cell${count > 1 ? 's' : ''}`, 'info');

	const onCopy = (e) => {
		if (editing || !rowCount) return;
		const { text, count } = selectionText();
		e.clipboardData.setData('text/plain', text);
		e.preventDefault();
		copiedNotice('Copied', count);
	};

	const onCut = (e) => {
		if (editing || !rowCount) return;
		e.preventDefault();
		const { text, count } = selectionText();
		e.clipboardData.setData('text/plain', text);
		copiedNotice('Cut', count);
		clearSelection(true);
	};

	/** Applies tab/newline separated text at the selection. Nothing is saved: edits stay unsaved until Save. */
	const applyPaste = (text) => {
		if (readOnly) return onNotice('This sheet is read-only.');
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
		else onNotice(`Pasted ${applied} cell${applied === 1 ? '' : 's'}. Review them, then Save.${extra}`, 'info');
	};

	const onPaste = (e) => {
		if (editing) return;
		e.preventDefault();
		// Plain text only: HTML on the clipboard is never read, so markup cannot be injected.
		applyPaste(e.clipboardData.getData('text/plain'));
	};

	// Toolbar / context-menu versions use the async clipboard API, which browsers may refuse.
	const blocked = () => onNotice('The browser blocked clipboard access. Click the grid and use Ctrl+C / Ctrl+X / Ctrl+V instead.');
	const apiRef = useRef(null);
	useImperativeHandle(ref, () => {
		apiRef.current = {
			focus: focusGrid,
			/** The selected cells as stable { key, field } pairs (used to apply device-local formatting). */
			selectedCells: () => {
				const bb = bounds();
				const out = [];
				for (let r = bb.ra; r <= bb.rb && out.length < 5000; r++) for (let c = bb.ca; c <= bb.cb; c++) if (rows[r] && columns[c]) out.push({ key: rows[r].key, field: columns[c].field });
				return out;
			},
			selectAll: () => setSel({ r0: 0, c0: 0, r1: Math.max(rowCount - 1, 0), c1: Math.max(colCount - 1, 0) }),
			clear: () => clearSelection(),
			copy: () => {
				if (!rowCount) return;
				const { text, count } = selectionText();
				if (!navigator.clipboard || !navigator.clipboard.writeText) return blocked();
				navigator.clipboard.writeText(text).then(() => copiedNotice('Copied', count), blocked);
			},
			cut: () => {
				if (!rowCount) return;
				const { text, count } = selectionText();
				if (!navigator.clipboard || !navigator.clipboard.writeText) return blocked();
				navigator.clipboard.writeText(text).then(() => {
					copiedNotice('Cut', count);
					clearSelection(true);
				}, blocked);
			},
			paste: () => {
				if (!navigator.clipboard || !navigator.clipboard.readText) return blocked();
				navigator.clipboard.readText().then(applyPaste, blocked);
			},
		};
		return apiRef.current;
	});

	// ---- keyboard -----------------------------------------------------------------------------
	const rowHeight = ROW_HEIGHT[density] || ROW_HEIGHT.compact;
	const pageRows = () => {
		const h = scrollRef.current ? scrollRef.current.clientHeight : 400;
		return Math.max(1, Math.floor((h - 40 * zoom) / (rowHeight * zoom)) - 1);
	};

	// Zoom: Ctrl/Cmd + wheel over the grid. The listener must be non-passive to stop the browser's own page zoom.
	const zoomPct = Math.round(zoom * 100);
	const zoomRef = useRef({ zoomPct, onZoom });
	zoomRef.current = { zoomPct, onZoom };
	useEffect(() => {
		const node = scrollRef.current;
		if (!node) return undefined;
		const onWheel = (e) => {
			if (!(e.ctrlKey || e.metaKey)) return;
			const { zoomPct: z, onZoom: set } = zoomRef.current;
			if (!set) return;
			e.preventDefault();
			set(e.deltaY < 0 ? zoomIn(z) : zoomOut(z));
		};
		node.addEventListener('wheel', onWheel, { passive: false });
		return () => node.removeEventListener('wheel', onWheel);
	}, []);

	// Keep the same part of the sheet in view when the scale changes.
	const prevZoom = useRef(zoom);
	useLayoutEffect(() => {
		const node = scrollRef.current;
		if (node && prevZoom.current !== zoom) {
			const k = zoom / prevZoom.current;
			node.scrollTop *= k;
			node.scrollLeft *= k;
		}
		prevZoom.current = zoom;
	}, [zoom]);
	const filled = (r, c) => String((rows[r] && rows[r].values[columns[c].field]) ?? '') !== '';

	const onKeyDown = (e) => {
		if (editing || e.target !== gridRef.current || !rowCount) return;
		const mod = e.ctrlKey || e.metaKey;
		const { r1, c1 } = sel;
		const go = (r, c) => {
			e.preventDefault();
			moveTo(r, c, e.shiftKey);
		};
		// Ctrl/Cmd + arrow jumps to the edge of the data run (Shift extends the selection to it).
		const jump = (dr, dc) => {
			const [r, c] = jumpTarget(filled, r1, c1, dr, dc, rowCount, colCount);
			return go(r, c);
		};
		switch (e.key) {
			case 'ArrowDown':
				return mod ? jump(1, 0) : go(r1 + 1, c1);
			case 'ArrowUp':
				return mod ? jump(-1, 0) : go(r1 - 1, c1);
			case 'ArrowRight':
				return mod ? jump(0, 1) : go(r1, c1 + 1);
			case 'ArrowLeft':
				return mod ? jump(0, -1) : go(r1, c1 - 1);
			case 'Home':
				return go(mod ? 0 : r1, 0);
			case 'End':
				return go(mod ? rowCount - 1 : r1, colCount - 1);
			case 'PageDown':
				return go(r1 + pageRows(), c1);
			case 'PageUp':
				return go(r1 - pageRows(), c1);
			case 'Tab': {
				e.preventDefault();
				const next = e.shiftKey ? (c1 === 0 ? [r1 - 1, colCount - 1] : [r1, c1 - 1]) : c1 === colCount - 1 ? [r1 + 1, 0] : [r1, c1 + 1];
				return moveTo(clampR(next[0]), clampC(next[1]), false);
			}
			case 'Enter':
				e.preventDefault();
				if (e.shiftKey) return moveTo(r1 - 1, c1, false);
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
		const k = e.key.toLowerCase();
		if (mod && k === 'a') {
			e.preventDefault();
			return setSel({ r0: 0, c0: 0, r1: rowCount - 1, c1: colCount - 1 });
		}
		if (mod && (k === 'b' || k === 'i') && !e.shiftKey && !e.altKey && onFormatShortcut) {
			e.preventDefault();
			return onFormatShortcut(k === 'b' ? 'bold' : 'italic');
		}
		if (mod && k === 'z') {
			e.preventDefault();
			return e.shiftKey ? onRedo() : onUndo();
		}
		if (mod && k === 'y') {
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

	// ---- context menu -------------------------------------------------------------------------
	const onContextMenu = (e) => {
		if (editing || !rowCount) return;
		const cell = e.target.closest && e.target.closest('[role="gridcell"], [role="rowheader"]');
		if (!cell) return;
		e.preventDefault();
		const m = /-(\d+)-(\d+)$/.exec(cell.id || '');
		if (m) {
			const r = Number(m[1]);
			const c = Number(m[2]);
			const bb = bounds();
			if (r < bb.ra || r > bb.rb || c < bb.ca || c > bb.cb) setSel({ r0: r, c0: c, r1: r, c1: c });
		}
		setMenu({ x: Math.min(e.clientX, window.innerWidth - 210), y: Math.min(e.clientY, window.innerHeight - 240) });
	};
	const closeMenu = () => {
		setMenu(null);
		focusGrid();
	};

	// ---- column resize ------------------------------------------------------------------------
	const startResize = (c, e) => {
		e.preventDefault();
		e.stopPropagation();
		const startX = e.clientX;
		const startW = widthOf(c);
		const node = scrollRef.current;
		const move = (ev) => {
			const w = Math.max(MIN_WIDTH, Math.round(startW + (ev.clientX - startX) / zoom));
			if (node) node.style.setProperty(`--col-${c}`, `${w}px`);
		};
		const up = (ev) => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			const w = Math.max(MIN_WIDTH, Math.round(startW + (ev.clientX - startX) / zoom));
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
		<div className="sheet__scroll" ref={scrollRef} style={{ ...cssVars, '--sheet-zoom': zoom, '--sheet-row-h': `${rowHeight * zoom}px` }}>
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
				onCut={onCut}
				onPaste={onPaste}
				onContextMenu={onContextMenu}
			>
				<div role="row" aria-rowindex={1} className="sheet__head">
					<div role="columnheader" className="sheet__corner" aria-label="Row numbers" />
					{columns.map((col, c) => {
						const dir = sort && sort.field === col.field ? sort.dir : null;
						const inSel = c >= ca && c <= cb;
						return (
							<div key={col.field} role="columnheader" aria-colindex={c + 2} aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={`sheet__col ${inSel ? 'is-selected' : ''}`.trim()} style={{ width: `calc(var(--col-${c}) * var(--sheet-zoom, 1))` }} onMouseDown={(e) => selectColumn(c, e)}>
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
							rTop={r === ra}
							rBottom={r === rb}
							activeC={r === sel.r1 ? sel.c1 : -1}
							editingC={editing && editing.r === r ? editing.c : -1}
							editInitial={editing && editing.r === r ? editing.initial : undefined}
							readOnly={readOnly}
							fmt={formats ? formats[row.key] : undefined}
							handlers={handlers}
						/>
					);
				})}
			</div>
			{menu
				? createPortal(
						<ContextMenu
							at={menu}
							onClose={closeMenu}
							items={[
								{ label: 'Cut', hint: 'Ctrl+X', disabled: readOnly, run: () => apiRef.current.cut() },
								{ label: 'Copy', hint: 'Ctrl+C', run: () => apiRef.current.copy() },
								{ label: 'Paste', hint: 'Ctrl+V', disabled: readOnly, run: () => apiRef.current.paste() },
								{ label: 'Clear contents', hint: 'Del', disabled: readOnly, run: () => apiRef.current.clear() },
								...(onDeleteRows && !readOnly ? [{ label: 'Delete selected rows…', danger: true, run: () => onDeleteRows() }] : []),
							]}
						/>,
						document.body
				  )
				: null}
		</div>
	);
});

export default SheetGrid;
