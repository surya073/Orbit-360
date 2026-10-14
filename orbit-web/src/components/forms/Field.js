import React, { useId } from 'react';

/** Labelled control with accessible error/hint wiring. `children` receives the control props. */
export default function Field({ label, error, required, hint, children, className = '' }) {
	const id = useId();
	const describedBy = [error ? `${id}-err` : null, hint && !error ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
	const props = { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, required: required || undefined };
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
			{error ? (
				<span id={`${id}-err`} className="field-error" role="alert">
					{error}
				</span>
			) : null}
		</div>
	);
}
