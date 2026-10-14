import React from 'react';
import { useTheme } from '../../app/providers/ThemeProvider';
import { Radio } from '../../components/forms/Choice';
import { DENSITIES } from '../../config/themes';

const HINTS = { comfortable: 'More breathing room in tables and controls', compact: 'Tighter rows and controls to show more on screen' };

/** Table/control density (saved on this device with the rest of the appearance). */
export default function DensitySelector() {
	const { density, setDensity } = useTheme();
	return (
		<div className="choice-group" role="radiogroup" aria-label="Density">
			{DENSITIES.map((d) => (
				<Radio key={d.id} name="density" label={d.label} hint={HINTS[d.id]} value={d.id} checked={density === d.id} onChange={() => setDensity(d.id)} />
			))}
		</div>
	);
}
