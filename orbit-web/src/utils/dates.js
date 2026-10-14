// Business dates are Asia/Kolkata. Date-only values are YYYY-MM-DD strings and are never
// passed through `new Date(...)` for display (that would shift them by the browser zone).
export const BUSINESS_TZ = 'Asia/Kolkata';

const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export function businessToday(now = new Date()) {
	return ymd.format(now);
}

export function monthRange(dateStr = businessToday()) {
	const [y, m] = dateStr.split('-').map(Number);
	const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
	const mm = String(m).padStart(2, '0');
	return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-03" -> "03 Oct 2026". Returns "—" for missing values (never a fake date). */
export function formatDate(s) {
	if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return '—';
	const [y, m, d] = s.slice(0, 10).split('-');
	return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** Catalyst datetimes are already in the project timezone (IST); show without conversion. */
export function formatDateTime(s) {
	if (!s) return '—';
	const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(s);
	return m ? `${formatDate(m[1])}, ${m[2]}` : '—';
}
