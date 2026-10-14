import React, { useId } from 'react';

/**
 * Styled checkbox / radio / switch. Each renders a real native <input> (keyboard, forms and screen
 * readers keep working); the CSS in styles/controls.css only draws it. `label` is always visible.
 */
function Choice({ kind, label, hint, className = '', ...rest }) {
	const id = useId();
	const hintId = hint ? `${id}-hint` : undefined;
	const isSwitch = kind === 'switch';
	return (
		<label className={`choice choice--${kind} ${rest.disabled ? 'is-disabled' : ''} ${className}`.trim()} htmlFor={id}>
			<input id={id} type={isSwitch ? 'checkbox' : kind} role={isSwitch ? 'switch' : undefined} aria-describedby={hintId} {...rest} />
			<span className="choice__mark" aria-hidden="true" />
			<span className="choice__text">
				<span className="choice__label">{label}</span>
				{hint ? (
					<span id={hintId} className="choice__hint">
						{hint}
					</span>
				) : null}
			</span>
		</label>
	);
}

export const Checkbox = (props) => <Choice kind="checkbox" {...props} />;
export const Radio = (props) => <Choice kind="radio" {...props} />;
export const Switch = (props) => <Choice kind="switch" {...props} />;
