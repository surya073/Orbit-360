import { layoutTree, planParts, treeFromNodes, treeStats } from '../reporting/treeModel';

/** Geometry of the slide body on the 1920x1080 canvas (below the title block, above the metrics strip). */
export const REPORTING_BODY = { w: 1728, h: 620 };
export const REPORTING_NODE = { nodeW: 210, nodeH: 160, gapX: 24, gapY: 56 };
export const REPORTING_MIN_SCALE = 0.75;
export const REPORTING_MAX_SCALE = 1.4;

/**
 * Turns the saved structure (GET /reporting-structure) into slide data: only real employees and
 * the saved parent links, split into readable parts. Returns null when nothing has been mapped, in
 * which case the deck simply has no reporting slide (no hierarchy is ever invented).
 */
export function buildReportingModel(data) {
	if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0) return null;
	const byId = new Map(data.employees.map((e) => [e.id, e]));
	const tree = treeFromNodes(data.nodes.filter((n) => byId.has(n.employeeId)));
	if (!Object.keys(tree).length) return null;
	const nameOf = (id) => (byId.get(id) ? byId.get(id).name : id);
	const stats = treeStats(tree, data.employees.length);
	const parts = planParts(tree, { nameOf, box: REPORTING_BODY, minScale: REPORTING_MIN_SCALE, ...REPORTING_NODE });
	return { team: data.team, byId, tree, nameOf, stats, parts };
}

/** Positions for one part, scaled to fit the slide body (never below the readable minimum except for one oversized part). */
export function layoutPart(model, part) {
	const l = layoutTree(model.tree, { nameOf: model.nameOf, rootIds: part.rootIds, maxDepth: part.maxDepth, ...REPORTING_NODE });
	const k = Math.min(Math.max(Math.min(REPORTING_BODY.w / Math.max(l.width, 1), REPORTING_BODY.h / Math.max(l.height, 1)), 0.3), REPORTING_MAX_SCALE);
	return { layout: l, k, offsetX: (REPORTING_BODY.w - l.width * k) / 2, offsetY: Math.max((REPORTING_BODY.h - l.height * k) / 2, 0) };
}
