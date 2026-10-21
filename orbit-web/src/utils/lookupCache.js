/**
 * Foreign-key labels (resource -> { id: label }) shared by every page for the whole session. Rows that name a team,
 * employee or project by id show its name from here instead of asking the server again.
 *
 * Pages that already load a full list of a resource can seed the cache from it (`seedLookup`), so the labels come for free
 * with a request that was being made anyway. Only a resource's label column is stored, and the lists are scoped by the
 * backend to what the signed-in user may see, so nothing here crosses a team boundary.
 */
export const lookupCache = {};

const LABEL_COLUMNS = { teams: 'name' };

export function seedLookup(resource, rows) {
	const col = LABEL_COLUMNS[resource];
	if (!col || !Array.isArray(rows)) return;
	const into = (lookupCache[resource] ||= {});
	rows.forEach((r) => {
		if (r && r.ROWID !== undefined && r.ROWID !== null && typeof r[col] === 'string') into[String(r.ROWID)] = r[col];
	});
}

export const clearLookupCache = () => Object.keys(lookupCache).forEach((k) => delete lookupCache[k]);
