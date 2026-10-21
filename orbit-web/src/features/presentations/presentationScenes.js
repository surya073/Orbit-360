/**
 * Slide "scenes": how the CONTENT of a slide enters (titles, cards, charts, rows), separate from the transition
 * between slides. In Varied mode every slide of a deck gets the next scene in the list, so no two neighbouring slides
 * move the same way. The CSS is styles/presentationScenes.css (`data-pscene` on the slide).
 */

export const SCENES = [
	{ id: 'rise', label: 'Rise', description: 'Everything floats up, one block after another.' },
	{ id: 'sweep', label: 'Sweep', description: 'The title slides in from the left, the content from the right.' },
	{ id: 'zoom', label: 'Zoom pop', description: 'Cards pop in with a small bounce.' },
	{ id: 'flip', label: 'Flip', description: 'Cards flip down into place like tiles.' },
	{ id: 'curtain', label: 'Curtain', description: 'Titles and blocks are revealed by a wipe.' },
	{ id: 'cascade', label: 'Cascade', description: 'Items arrive alternately from both sides.' },
	{ id: 'focus', label: 'Settle', description: 'Content eases into place from slightly larger.' },
	{ id: 'spin', label: 'Spin in', description: 'Cards turn and scale into place.' },
];

/** Options shown to the viewer: Varied (a different scene per slide) or one fixed scene for the whole deck. */
export const SCENE_CHOICES = [{ id: 'auto', label: 'Varied', description: 'A different animation on every slide.' }, ...SCENES, { id: 'none', label: 'Off', description: 'Content appears with the slide, no extra movement.' }];

const SCENE_IDS = SCENES.map((s) => s.id);
const KEY = 'company360.presentationScene';

/** The scene a slide plays: the fixed choice, or, when Varied, the next one in the list for each slide. */
export function sceneFor(choice, index) {
	if (choice === 'none') return 'none';
	if (SCENE_IDS.includes(choice)) return choice;
	return SCENE_IDS[Math.max(0, index) % SCENE_IDS.length];
}

export function readStoredScene() {
	try {
		const v = window.localStorage.getItem(KEY);
		return v === 'auto' || v === 'none' || SCENE_IDS.includes(v) ? v : 'auto';
	} catch {
		return 'auto';
	}
}

export function storeScene(id) {
	try {
		if (id === 'auto' || id === 'none' || SCENE_IDS.includes(id)) window.localStorage.setItem(KEY, id);
	} catch {
		/* not remembered */
	}
}
