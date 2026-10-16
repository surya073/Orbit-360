import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import Select from '../components/forms/Select';
import { pickOption } from './pickOption';

function Demo({ onChange }) {
	const [v, setV] = useState('b');
	return (
		<label>
			Fruit
			<Select
				value={v}
				onChange={(e) => {
					setV(e.target.value);
					onChange(e.target.value);
				}}
			>
				<option value="a">Apple</option>
				<option value="b">Banana</option>
				<option value="c">Cherry</option>
				<option value="d" disabled>
					Durian
				</option>
			</Select>
		</label>
	);
}

describe('custom Select', () => {
	test('shows the selected label and picks with the mouse', async () => {
		const onChange = jest.fn();
		render(<Demo onChange={onChange} />);
		const box = screen.getByRole('combobox', { name: 'Fruit' });
		expect(box).toHaveTextContent('Banana');
		await pickOption(box, 'c');
		expect(onChange).toHaveBeenCalledWith('c');
		expect(box).toHaveTextContent('Cherry');
		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
	});

	test('keyboard: arrows move (skipping disabled), Enter picks, Escape closes, type-ahead jumps', async () => {
		const onChange = jest.fn();
		render(<Demo onChange={onChange} />);
		const box = screen.getByRole('combobox', { name: 'Fruit' });
		box.focus();
		await userEvent.keyboard('{ArrowDown}');
		expect(box).toHaveAttribute('aria-expanded', 'true');
		await userEvent.keyboard('{ArrowDown}{ArrowDown}'); // b -> c -> a (d is disabled)
		await userEvent.keyboard('{Enter}');
		expect(onChange).toHaveBeenLastCalledWith('a');
		await userEvent.keyboard('{ArrowDown}{Escape}');
		expect(box).toHaveAttribute('aria-expanded', 'false');
		await userEvent.keyboard('c'); // closed: type-ahead selects directly
		expect(onChange).toHaveBeenLastCalledWith('c');
	});

	test('a disabled option cannot be picked', async () => {
		const onChange = jest.fn();
		render(<Demo onChange={onChange} />);
		await userEvent.click(screen.getByRole('combobox', { name: 'Fruit' }));
		await userEvent.click(screen.getByRole('option', { name: 'Durian' }));
		expect(onChange).not.toHaveBeenCalled();
	});
});
