'use strict';

const { errors } = require('../utils/errors');
const { f, isId, validateRecord } = require('./schema');
const { isValidDate } = require('../utils/dateUtils');
const { LIMITS } = require('../config/constants');

// `section` slides render live data for the saved period/filters at presentation time.
const SECTIONS = ['executive_summary', 'employee_overview', 'attendance_leave', 'project_performance', 'billable_hours', 'product_development', 'ai_usage', 'key_insights'];
const SLIDE_TYPES = ['section', 'title', 'snapshot', 'text'];
const PERIOD_PRESETS = ['this_month', 'last_month', 'last_30_days', 'this_quarter', 'custom'];
const FIELDS = { title: f.str(200, { req: true }), team_id: f.id(), status: f.oneOf(['draft', 'ready']) };

/** slides_config slides: array of { type, section?, title?, body?, snapshotId? }. */
function validateSlides(slides) {
	const errs = [];
	if (!Array.isArray(slides)) return { errors: [{ field: 'slides', code: 'INVALID_TYPE', message: 'Must be an array' }], slides: [] };
	if (slides.length > LIMITS.maxSlides) errs.push({ field: 'slides', code: 'TOO_MANY', message: `At most ${LIMITS.maxSlides} slides` });
	const clean = slides.slice(0, LIMITS.maxSlides).map((s, i) => {
		const field = `slides[${i}]`;
		if (!s || typeof s !== 'object' || !SLIDE_TYPES.includes(s.type)) {
			errs.push({ field, code: 'INVALID_VALUE', message: `type must be one of ${SLIDE_TYPES.join(', ')}` });
			return null;
		}
		if (s.type === 'snapshot' && !isId(String(s.snapshotId || ''))) errs.push({ field, code: 'INVALID_ID', message: 'snapshotId is required for snapshot slides' });
		if (s.type === 'section' && !SECTIONS.includes(s.section)) errs.push({ field, code: 'INVALID_VALUE', message: `section must be one of ${SECTIONS.join(', ')}` });
		return {
			type: s.type,
			section: s.type === 'section' ? s.section : undefined,
			title: typeof s.title === 'string' ? s.title.slice(0, 200) : undefined,
			body: typeof s.body === 'string' ? s.body.slice(0, 2000) : undefined,
			snapshotId: s.snapshotId ? String(s.snapshotId) : undefined,
		};
	});
	return { errors: errs, slides: clean, json: JSON.stringify(clean) };
}

function validatePeriod(p) {
	if (p === undefined) return { period: { preset: 'this_month' }, errors: [] };
	if (!p || typeof p !== 'object' || !PERIOD_PRESETS.includes(p.preset)) return { errors: [{ field: 'period', code: 'INVALID_VALUE', message: `preset must be one of ${PERIOD_PRESETS.join(', ')}` }] };
	if (p.preset !== 'custom') return { period: { preset: p.preset }, errors: [] };
	if (!isValidDate(p.from) || !isValidDate(p.to) || p.to < p.from) return { errors: [{ field: 'period', code: 'INVALID_RANGE', message: 'Custom period needs valid from/to dates (from <= to)' }] };
	return { period: { preset: 'custom', from: p.from, to: p.to }, errors: [] };
}

function presentationBody({ partial = false } = {}) {
	return (raw) => {
		const { slides, period, filters, ...rest } = raw;
		const { value, errors: errs } = validateRecord(FIELDS, rest, { partial });
		const out = { ...value };
		if (slides !== undefined) {
			const s = validateSlides(slides);
			errs.push(...s.errors);
			out.slides = s.slides;
		} else if (!partial) {
			errs.push({ field: 'slides', code: 'REQUIRED', message: 'Required' });
		}
		if (period !== undefined || !partial) {
			const p = validatePeriod(period);
			errs.push(...p.errors);
			out.period = p.period;
		}
		if (filters !== undefined) {
			if (!filters || typeof filters !== 'object' || Array.isArray(filters)) errs.push({ field: 'filters', code: 'INVALID_TYPE', message: 'Must be an object' });
			else if (filters.project_id !== undefined && filters.project_id !== null && filters.project_id !== '' && !isId(String(filters.project_id))) errs.push({ field: 'filters', code: 'INVALID_ID', message: 'project_id must be a numeric id' });
			else out.projectId = filters.project_id ? String(filters.project_id) : null;
		} else if (!partial) out.projectId = null;
		if (errs.length) throw errors.validation(errs);
		if (partial && Object.keys(out).length === 0) throw errors.badRequest('No fields to update');
		return out;
	};
}

module.exports = { validateSlides, presentationBody, SECTIONS, PERIOD_PRESETS };
