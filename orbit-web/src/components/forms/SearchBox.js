import React, { forwardRef } from 'react';
import { IconButton } from '../common/Button';
import Icon from '../common/Icon';

/**
 * The one search box: magnifier, input and a single clear (x) button that appears once there is text. The browser's own
 * clear button for type="search" is hidden globally (styles/controls.css), so a box never shows two. Escape clears too.
 * `onChange` receives the new text, not the event. Other props (aria-label, placeholder, id, ...) go to the input.
 */
const SearchBox = forwardRef(function SearchBox({ value, onChange, className = '', inputClassName = 'input', clearLabel = 'Clear search', onKeyDown, ...rest }, ref) {
	return (
		<div className={`search-input ${className}`.trim()}>
			<Icon name="search" size={14} />
			<input
				ref={ref}
				type="search"
				className={inputClassName}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Escape' && value) {
						e.preventDefault();
						e.stopPropagation();
						onChange('');
					}
					if (onKeyDown) onKeyDown(e);
				}}
				{...rest}
			/>
			{value ? <IconButton className="clear" icon="x" label={clearLabel} onClick={() => onChange('')} /> : null}
		</div>
	);
});

export default SearchBox;
