/**
 * Pure slide-list builder for the presentation viewer. The saved deck (sections, text, snapshot
 * slides) is never changed: the viewer wraps it with a generated opening and closing slide and,
 * when asked, inserts detail slides built from real records right after the matching section.
 *
 *   employee_overview   -> people overview slides (+ individual profile slides)
 *   project_performance -> project record slides
 */
export const PEOPLE_LIMIT = 16; // people fetched (one request)
export const PEOPLE_PER_SLIDE = 8;
export const PROFILE_LIMIT = 8; // individual profile slides
export const RECORDS_LIMIT = 12; // projects fetched (one request)
export const RECORDS_PER_SLIDE = 6;

const chunk = (list, n) => {
	const out = [];
	for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
	return out;
};

/** `res` is a useApiResource-like { status, data, meta, error } or null when the option is off. */
/** Activity of one person for their profile slide: loading | error | ready (data = backend per-person metrics). */
function activityFor(profiles, person) {
	if (!profiles || profiles.status === 'loading' || profiles.status === 'idle') return { status: 'loading' };
	if (profiles.status === 'error') return { status: 'error', error: profiles.error };
	const data = profiles.data && profiles.data.people && profiles.data.people[String(person.ROWID)];
	return data ? { status: 'ready', data } : { status: 'error' };
}

function peopleSlides(res, profiles) {
	if (!res || res.status === 'loading' || res.status === 'idle') return [{ kind: 'detail-state', topic: 'people', state: 'loading' }];
	if (res.status === 'error') return [{ kind: 'detail-state', topic: 'people', state: 'error', error: res.error }];
	const rows = res.data || [];
	if (rows.length === 0) return [{ kind: 'detail-state', topic: 'people', state: 'empty' }];
	const total = res.meta && Number.isFinite(res.meta.total) ? res.meta.total : rows.length;
	const groups = chunk(rows, PEOPLE_PER_SLIDE);
	const overview = groups.map((g, i) => ({ kind: 'people', rows: g, part: i + 1, parts: groups.length, total, shown: rows.length, offset: i * PEOPLE_PER_SLIDE }));
	const profileSlides = rows.slice(0, PROFILE_LIMIT).map((person, i, all) => ({ kind: 'profile', person, n: i + 1, of: all.length, total, activity: activityFor(profiles, person) }));
	return [...overview, ...profileSlides];
}

function recordSlides(res) {
	if (!res || res.status === 'loading' || res.status === 'idle') return [{ kind: 'detail-state', topic: 'projects', state: 'loading' }];
	if (res.status === 'error') return [{ kind: 'detail-state', topic: 'projects', state: 'error', error: res.error }];
	const rows = res.data || [];
	if (rows.length === 0) return [{ kind: 'detail-state', topic: 'projects', state: 'empty' }];
	const total = res.meta && Number.isFinite(res.meta.total) ? res.meta.total : rows.length;
	const groups = chunk(rows, RECORDS_PER_SLIDE);
	return groups.map((g, i) => ({ kind: 'records', rows: g, part: i + 1, parts: groups.length, total, shown: rows.length }));
}

/**
 * Team reporting structure: nothing is added while no tree is saved (the slide is omitted, never
 * faked). `reporting` is { status, error?, model } from the saved-structure request.
 */
function reportingSlides(reporting) {
	if (!reporting || reporting.status === 'loading' || reporting.status === 'idle') return [{ kind: 'reporting-state', state: 'loading' }];
	if (reporting.status === 'error') return [{ kind: 'reporting-state', state: 'error', error: reporting.error }];
	const model = reporting.model;
	if (!model || !model.parts.length) return [];
	return model.parts.map((plan, i) => ({ kind: 'reporting', model, plan, part: i + 1, parts: model.parts.length }));
}

export function buildSlides(deckSlides, { people = null, records = null, wantPeople = false, wantRecords = false, reporting = null, profiles = null, addReporting = false } = {}) {
	// A deck with free-form studio slides brings its own cover and closing: no generated opening or "Thank you" slide.
	const studio = (deckSlides || []).some((s) => s.type === 'custom');
	const out = studio ? [] : [{ kind: 'opening' }];
	// A deck without the Team reporting structure section can still be shown with it (launcher option):
	// it goes after the employee section (and its detail slides), else just before the closing slide.
	const hasSection = (deckSlides || []).some((s) => s.type === 'section' && s.section === 'reporting_structure');
	let pendingReporting = addReporting && !hasSection;
	for (const s of deckSlides || []) {
		if (s.type === 'section' && s.section === 'reporting_structure') {
			out.push(...reportingSlides(reporting));
			continue;
		}
		out.push(s.type === 'custom' ? { kind: 'custom', slide: s } : { kind: 'deck', slide: s });
		if (s.type === 'section' && s.section === 'employee_overview' && wantPeople) out.push(...peopleSlides(people, profiles));
		if (s.type === 'section' && s.section === 'project_performance' && wantRecords) out.push(...recordSlides(records));
		if (pendingReporting && s.type === 'section' && s.section === 'employee_overview') {
			out.push(...reportingSlides(reporting));
			pendingReporting = false;
		}
	}
	if (pendingReporting) out.push(...reportingSlides(reporting));
	if (!studio) out.push({ kind: 'closing' });
	return out;
}

/** Which optional detail slides a deck can offer, from its saved sections. */
export function detailOptions(deckSlides) {
	const sections = new Set((deckSlides || []).filter((s) => s.type === 'section').map((s) => s.section));
	return { people: sections.has('employee_overview'), records: sections.has('project_performance'), reporting: !sections.has('reporting_structure') };
}

export const initials = (name) =>
	String(name || '')
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((w) => w[0] || '')
		.join('')
		.toUpperCase() || '?';

/** Whole years and months between a date (YYYY-MM-DD) and today, calculated; null when unknown. */
export function tenureText(joining, today = new Date()) {
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(joining || ''));
	if (!m) return null;
	let months = (today.getFullYear() - Number(m[1])) * 12 + (today.getMonth() + 1 - Number(m[2]));
	if (today.getDate() < Number(m[3])) months -= 1;
	if (months < 0) return null;
	const y = Math.floor(months / 12);
	const mo = months % 12;
	const parts = [y ? `${y} yr${y > 1 ? 's' : ''}` : '', mo || !y ? `${mo} mo` : ''].filter(Boolean);
	return parts.join(' ');
}

export const statusTone = (s) => {
	const v = String(s || '').toLowerCase();
	if (/^(active|complete|completed|done|live|approved)/.test(v)) return 'good';
	if (/(leave|hold|risk|delay|pending|review)/.test(v)) return 'warn';
	if (/(inactive|cancel|closed|rejected)/.test(v)) return 'bad';
	return 'neutral';
};
