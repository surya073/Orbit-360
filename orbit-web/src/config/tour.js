import { visibleNav } from './navigation';

/** Remembers, per device, that the welcome tour has been offered. Replaying it never needs this. */
export const TOUR_KEY = 'company360.tour.v1';

export function hasSeenTour() {
	try {
		return window.localStorage.getItem(TOUR_KEY) === 'seen';
	} catch {
		return true; // storage blocked: never nag
	}
}

export function markTourSeen() {
	try {
		window.localStorage.setItem(TOUR_KEY, 'seen');
	} catch {
		/* not remembered */
	}
}

/** `data-tour` value of a navigation entry ("People" -> "nav-people"). */
export const navTarget = (label) => `nav-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

// What each part of the app is for, in the words of the people who use it.
const NAV_COPY = {
	Dashboard: { icon: 'dashboard', title: 'Your command centre', body: 'Live KPIs, billable share, late check-ins and project health, with filters for any period. Everything is calculated from approved data, and gaps are shown honestly instead of as zeros.' },
	People: { icon: 'users', title: 'People', body: 'The employee directory, teams, attendance, leave and performance, plus a drag-and-drop reporting structure.' },
	Delivery: { icon: 'folder', title: 'Delivery', body: 'Projects and assignments, time entries with approvals, product work and the AI tools your teams report using.' },
	Imports: { icon: 'upload', title: 'Bring your data in', body: 'Upload a CSV, review any conflicts, then commit in safe batches. Prefer typing? Open the spreadsheet editor from here to edit records in a full-screen grid with formatting, undo and redo.' },
	Presentations: { icon: 'present', title: 'Present with confidence', body: 'Turn live data into an executive deck in five themes, with individual profiles and your reporting tree. Press play and you are on stage.' },
	Access: { icon: 'lock', title: 'Control who sees what', body: 'Create roles, choose exactly what each one may view, create, edit, delete or approve, and assign them to people, team by team.' },
};

const FIXED = {
	search: { target: 'search', icon: 'search', title: 'Find anything, fast', body: 'Search employees, projects, product items and pages from anywhere.', hint: 'Press Ctrl K (⌘K on Mac) to open it without the mouse.' },
	appearance: { target: 'appearance', icon: 'palette', title: 'Make it yours', body: 'Settings is where you pick one of seven themes, an icon style and your dashboard layout. They apply instantly and are remembered on this device.' },
	account: { target: 'account', icon: 'user', title: 'Your account', body: 'Who you are signed in as, at the bottom of the sidebar. Your profile, settings and sign-out are in its menu, and you can replay this tour from there whenever you like.' },
};

/**
 * The tour for one user: a step for every part of the app they can actually open (the same permission
 * rules as the navigation), then search, appearance and account. `can(permissionKey)` decides.
 */
export function buildSteps(can) {
	const steps = visibleNav(can).map((n) => {
		const copy = NAV_COPY[n.label] || { icon: n.icon, title: n.label, body: '' };
		return {
			id: navTarget(n.label),
			target: navTarget(n.label),
			icon: copy.icon,
			title: copy.title,
			body: copy.body,
			// A group lists the pages inside it, so nobody has to open the menu to learn what is there.
			chips: n.type === 'group' ? n.items.map((i) => i.label) : [],
		};
	});
	for (const key of ['search', 'appearance', 'account']) steps.push({ id: key, chips: [], ...FIXED[key] });
	return steps;
}
