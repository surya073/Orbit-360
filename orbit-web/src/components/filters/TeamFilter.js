import React from 'react';
import { useAuth } from '../../app/providers/AuthProvider';
import useApiResource from '../../hooks/useApiResource';
import { resourceService } from '../../services/resourceService';
import Field from '../forms/Field';
import Select from '../forms/Select';

/**
 * Admins choose a team (or all). Managers see their own team as a fixed chip: the backend pins
 * them to it regardless of what the UI sends.
 */
export default function TeamFilter({ value, onChange }) {
	const { user } = useAuth();
	const teams = useApiResource((signal) => resourceService.list('teams', { pageSize: 100 }, { signal }), 'teams-filter', { isEmpty: () => false });
	if (user.role !== 'admin') {
		const mine = (teams.data || []).find((t) => String(t.ROWID) === String(user.teamId));
		return (
			<span className="chip" title="Managers only see their assigned team">
				Team: {mine ? mine.name : teams.status === 'error' ? 'unavailable' : '…'}
			</span>
		);
	}
	return (
		<Field label="Team">
			{(p) => (
				<Select {...p} value={value || ''} onChange={(e) => onChange(e.target.value)}>
					<option value="">All teams</option>
					{(teams.data || []).map((t) => (
						<option key={t.ROWID} value={t.ROWID}>
							{t.name}
						</option>
					))}
				</Select>
			)}
		</Field>
	);
}
