import React from 'react';
import { IconButton } from '../common/Button';
import Icon from '../common/Icon';

/** Text search box with a clear button. Debounce in the caller (useDebouncedValue). */
export default function SearchInput({ value, onChange, label = 'Search', placeholder, autoFocus }) {
	return (
		<div className="field">
			<label htmlFor={`search-${label}`}>{label}</label>
			<div className="search-input">
				<Icon name="search" size={14} />
				<input id={`search-${label}`} type="search" className="input" value={value} placeholder={placeholder} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />
				{value ? <IconButton className="clear" icon="x" label="Clear search" onClick={() => onChange('')} /> : null}
			</div>
		</div>
	);
}
