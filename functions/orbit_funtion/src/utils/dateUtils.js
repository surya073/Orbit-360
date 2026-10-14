'use strict';

// Business dates are Asia/Kolkata. Date-only columns are YYYY-MM-DD strings.
const BUSINESS_TZ = 'Asia/Kolkata';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(s) {
	if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
	const d = new Date(`${s}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-CA', {
	timeZone: BUSINESS_TZ,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hourCycle: 'h23',
});

/** Today's business date (YYYY-MM-DD) in Asia/Kolkata. */
const businessToday = (now = new Date()) => dayFmt.format(now);

/** Current Asia/Kolkata wall-clock as a Data Store datetime (yyyy-MM-dd HH:mm:ss). */
function businessNow(now = new Date()) {
	const parts = timeFmt.formatToParts(now);
	const g = (t) => parts.find((p) => p.type === t).value;
	return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}:${g('second')}`;
}

function monthRange(dateStr) {
	const [y, m] = dateStr.split('-').map(Number);
	const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
	const mm = String(m).padStart(2, '0');
	return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/** Adds whole days to a YYYY-MM-DD date. */
const addDays = (dateStr, n) => new Date(Date.parse(`${dateStr}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Monday of the ISO week containing dateStr. */
function weekStart(dateStr) {
	const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0=Sun
	return addDays(dateStr, -((dow + 6) % 7));
}

module.exports = { BUSINESS_TZ, isValidDate, businessToday, businessNow, monthRange, daysBetween, addDays, weekStart };
