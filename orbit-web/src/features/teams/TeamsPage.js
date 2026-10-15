import React from 'react';
import { defineModule } from '../resources/defineModule';
import ResourcePage from '../resources/ResourcePage';

export const teamsConfig = defineModule({
	title: 'Teams',
	singular: 'team',
	description: 'Team structure. Who can add or change teams is set under Access.',
	resource: 'teams',
	search: 'Search by team name',
	writable: true,
	addLabel: 'Add team',
	columns: [
		{ key: 'name', label: 'Team' },
		{ key: 'team_code', label: 'Code' },
		{ key: 'description', label: 'Description' },
		{ key: 'is_active', label: 'Active', type: 'bool' },
	],
});

export default function TeamsPage() {
	return <ResourcePage config={teamsConfig} />;
}
