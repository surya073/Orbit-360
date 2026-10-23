import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorState from '../components/feedback/ErrorState';
import { ApiClientError } from '../services/apiClient';

describe('error state', () => {
	test('a data-model error shows which table and column are at fault so an administrator can fix the Data Store', () => {
		const error = new ApiClientError({ status: 500, code: 'DATASTORE_SCHEMA', message: 'The data model does not match the server configuration', details: [{ message: 'Table product_items is missing column(s): item_priority.' }], requestId: 'abcdef123456' });
		render(<ErrorState error={error} />);
		expect(screen.getByText('The data model does not match the server configuration')).toBeInTheDocument();
		expect(screen.getByText(/product_items is missing column\(s\): item_priority/)).toBeInTheDocument();
	});

	test('details of an ordinary error are never shown', () => {
		const error = new ApiClientError({ status: 500, code: 'INTERNAL_ERROR', message: 'Unexpected server error', details: [{ message: 'secret row value' }] });
		render(<ErrorState error={error} />);
		expect(screen.queryByText(/secret row value/)).not.toBeInTheDocument();
	});
});
