/** Small helpers shared by the employee directory card and the employee detail dialog. */

export const initials = (name) =>
	String(name || '?')
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0].toUpperCase())
		.join('');

/** Time since a date as "3 y 2 m with us" (or "Joined this month"); null when the date is missing or in the future. */
export function tenure(joined) {
	if (!joined) return null;
	const start = new Date(`${String(joined).slice(0, 10)}T00:00:00Z`);
	if (Number.isNaN(start.getTime())) return null;
	const now = new Date();
	const months = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth());
	if (months < 0) return null;
	if (months < 1) return 'Joined this month';
	const y = Math.floor(months / 12);
	const m = months % 12;
	return `${y ? `${y} y ` : ''}${m ? `${m} m` : ''}`.trim() + ' with us';
}
