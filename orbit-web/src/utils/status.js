const TONES = {
	success: ['approved', 'active', 'completed', 'complete', 'done', 'finalized', 'committed', 'ready', 'closed', 'released', 'yes_on_time'],
	warning: ['pending', 'on_hold', 'partial', 'requested', 'submitted', 'draft', 'conflict', 'unknown', 'validating', 'uploaded', 'committing', 'in_progress', 'open', 'incomplete'],
	danger: ['rejected', 'failed', 'invalid', 'cancelled', 'blocked', 'completed_with_errors'],
	info: ['valid', 'validated', 'skipped', 'insufficient_data', 'not_applicable'],
};

/** Maps a status string to a badge tone. Unknown values are neutral (never implied good/bad). */
export function toneFor(status) {
	const s = String(status || '').toLowerCase();
	return Object.keys(TONES).find((tone) => TONES[tone].includes(s)) || 'neutral';
}
