import React from 'react';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { MOD } from './SheetToolbar';

const SHIFT = 'Shift+';
const GROUPS = [
	{
		title: 'Move',
		rows: [
			['Arrow keys', 'Move the active cell'],
			['Tab / Shift+Tab', 'Next / previous cell'],
			['Enter (editing)', 'Commit and move down'],
			['Shift+Enter', 'Move up (commit and move up while editing)'],
			['Home / End', 'First / last cell in the row'],
			[`${MOD}Home / ${MOD}End`, 'First cell / last row and column'],
			['Page Up / Page Down', 'Move by one screen of rows'],
			[`${MOD}Arrow`, 'Jump to the edge of the data'],
		],
	},
	{
		title: 'Select',
		rows: [
			[`${SHIFT}Arrow`, 'Extend the selection'],
			[`${MOD}${SHIFT}Arrow`, 'Extend to the edge of the data'],
			['Click row number / column header', 'Select a whole row / column'],
			[`${SHIFT}Click`, 'Extend the selection to the clicked cell'],
			['Drag', 'Select a rectangle of cells'],
			[`${MOD}A`, 'Select all loaded rows'],
			['Esc', 'Collapse to the active cell'],
		],
	},
	{
		title: 'Edit',
		rows: [
			['Type, Enter, F2 or double-click', 'Start editing the active cell'],
			['Esc (editing)', 'Cancel the edit'],
			['Delete / Backspace', 'Clear the selected cells'],
			[`${MOD}C / ${MOD}X / ${MOD}V`, 'Copy / cut / paste (tab-separated, works with Excel and Google Sheets)'],
			[`${MOD}Z / ${MOD}Y`, 'Undo / redo'],
			[`${MOD}S`, 'Save changes'],
			[`${MOD}B / ${MOD}I`, 'Bold / italic for the selected cells (this device only)'],
			[`${MOD}Wheel`, 'Zoom the grid in and out'],
			[`${MOD}F`, 'Search this sheet'],
			['Right-click', 'Cut, copy, paste, clear, delete rows'],
		],
	},
];

/** Only shortcuts that are implemented in SheetGrid / SpreadsheetPage are listed. */
export default function SheetShortcuts({ onClose }) {
	return (
		<Modal
			title="Keyboard shortcuts"
			onClose={onClose}
			size="lg"
			footer={
				<Button variant="primary" onClick={onClose} data-autofocus>
					Close
				</Button>
			}
		>
			<div className="shortcuts">
				{GROUPS.map((g) => (
					<section key={g.title}>
						<h3>{g.title}</h3>
						<dl>
							{g.rows.map(([k, d]) => (
								<div key={k}>
									<dt>
										<kbd>{k}</kbd>
									</dt>
									<dd>{d}</dd>
								</div>
							))}
						</dl>
					</section>
				))}
			</div>
		</Modal>
	);
}
