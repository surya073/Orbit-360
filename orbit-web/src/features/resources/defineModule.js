/**
 * Normalises a module config. `columns[].type` selects the cell renderer (see renderCell);
 * `fkColumns` is derived so foreign-key ids display as names via one batched lookup per page.
 */
export function defineModule(cfg) {
	return {
		filters: [],
		writable: false,
		...cfg,
		fkColumns: cfg.columns.filter((c) => c.type === 'fk').map((c) => c.key),
	};
}
