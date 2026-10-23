import React from 'react';
import SearchBox from '../forms/SearchBox';

/** Text search box with a clear button. Debounce in the caller (useDebouncedValue). */
export default function SearchInput({ value, onChange, label = 'Search', placeholder, autoFocus }) {
	return (
		<div className="field">
			<label htmlFor={`search-${label}`}>{label}</label>
			<SearchBox id={`search-${label}`} value={value} onChange={onChange} placeholder={placeholder} autoFocus={autoFocus} />
		</div>
	);
}
