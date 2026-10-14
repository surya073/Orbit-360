import React from 'react';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Reorderable list. Three ways to reorder, all producing the same onReorder(ids):
 *   - pointer / touch: drag the handle (touch needs a short press so scrolling still works)
 *   - keyboard: focus the handle, Space/Enter to lift, arrows to move, Space/Enter to drop, Esc to cancel
 *   - buttons: renderItem receives moveUp / moveDown for explicit "Move up" / "Move down" controls
 * A drop indicator shows where the item will land. dnd-kit announces each step to screen readers.
 */
function Row({ item, index, count, renderItem, move }) {
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: item.id });
	const style = { transform: CSS.Transform.toString(transform), transition };
	const handle = (
		<button ref={setActivatorNodeRef} type="button" className="drag-handle" aria-label={`Reorder ${item.label}. Press space to pick up, arrow keys to move, space to drop.`} {...attributes} {...listeners}>
			<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false" fill="currentColor">
				{[3, 7, 11].map((y) => [4, 10].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.25" />))}
			</svg>
		</button>
	);
	return (
		<li ref={setNodeRef} style={style} className={`sortable-row ${isDragging ? 'is-dragging' : ''} ${isOver && !isDragging ? 'is-over' : ''}`.trim()}>
			{renderItem(item, { handle, index, isFirst: index === 0, isLast: index === count - 1, isDragging, moveUp: () => move(index, -1), moveDown: () => move(index, 1) })}
		</li>
	);
}

export default function SortableList({ items, onReorder, renderItem, label }) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);
	const ids = items.map((i) => i.id);
	const move = (index, delta) => {
		const to = index + delta;
		if (to < 0 || to >= items.length) return;
		onReorder(arrayMove(ids, index, to));
	};
	const onDragEnd = ({ active, over }) => {
		if (!over || active.id === over.id) return;
		onReorder(arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)));
	};
	const name = (id) => (items.find((i) => i.id === id) || {}).label || String(id);
	const announcements = {
		onDragStart: ({ active }) => `Picked up ${name(active.id)}. Position ${ids.indexOf(active.id) + 1} of ${ids.length}.`,
		onDragOver: ({ active, over }) => (over ? `${name(active.id)} is now at position ${ids.indexOf(over.id) + 1} of ${ids.length}.` : undefined),
		onDragEnd: ({ active, over }) => (over ? `Dropped ${name(active.id)} at position ${ids.indexOf(over.id) + 1} of ${ids.length}.` : `Dropped ${name(active.id)}.`),
		onDragCancel: ({ active }) => `Reordering cancelled. ${name(active.id)} returned to its place.`,
	};
	return (
		<DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onDragEnd} accessibility={{ announcements, screenReaderInstructions: { draggable: 'To reorder, press space, move with the arrow keys, then press space again to drop. Escape cancels.' } }}>
			<SortableContext items={ids} strategy={verticalListSortingStrategy}>
				<ol className="sortable-list" aria-label={label}>
					{items.map((item, index) => (
						<Row key={item.id} item={item} index={index} count={items.length} renderItem={renderItem} move={move} />
					))}
				</ol>
			</SortableContext>
		</DndContext>
	);
}
