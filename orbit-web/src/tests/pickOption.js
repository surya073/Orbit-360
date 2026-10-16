import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const optionsOf = async () => within(await screen.findByRole('listbox')).queryAllByRole('option');

/** Choose an option of a custom Select (forms/Select): open it, wait for the option with this value, click it. */
export async function pickOption(trigger, value) {
	await userEvent.click(trigger);
	let option;
	await waitFor(async () => {
		option = (await optionsOf()).find((o) => o.getAttribute('data-value') === String(value));
		expect(option).toBeTruthy();
	});
	await userEvent.click(option);
}

/** The values a custom Select currently offers (opens it, reads them, closes it again). */
export async function optionValues(trigger) {
	await userEvent.click(trigger);
	const values = (await optionsOf()).map((o) => o.getAttribute('data-value'));
	await userEvent.keyboard('{Escape}');
	return values;
}
