import React, { useId } from 'react';
import Icon from '../common/Icon';

/**
 * Labelled control with accessible error/hint wiring. `children` receives the control props.
 * States: `error` (invalid, announced), `success` (valid; pass true or a short message), plus
 * whatever the control itself carries (disabled / readOnly), which controls.css styles.
 */
export default function Field({ label, error, success, required, hint, children, className = '' }) {
	const id = useId();
	const valid = Boolean(success) && !error;
	const describedBy = [error ? `${id}-err` : null, valid && typeof success === 'string' ? `${id}-ok` : null, hint && !error ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
	const props = { id, 'aria-invalid': error ? true : undefined, 'data-valid': valid ? 'true' : undefined, 'aria-describedby': describedBy, required: required || undefined };
	return (
		<div className={`field ${className}`.trim()}>
			<label htmlFor={id}>
				{label}
				{required ? <span aria-hidden="true"> *</span> : null}
			</label>
			{children(props)}
			{hint && !error ? (
				<span id={`${id}-hint`} className="field-hint">
					{hint}
				</span>
			) : null}
			{valid && typeof success === 'string' ? (
				<span id={`${id}-ok`} className="field-ok">
					<Icon name="check" size={13} />
					{success}
				</span>
			) : null}
			{error ? (
				<span id={`${id}-err`} className="field-error" role="alert">
					<Icon name="alert" size={13} />
					{error}
				</span>
			) : null}
		</div>
	);
}
