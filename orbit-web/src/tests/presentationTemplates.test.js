import { REPORT_SECTIONS } from '../config/constants';
import { DECK_TEMPLATES, LAYOUTS, LAYOUT_IDS, layoutById, templateById } from '../features/presentations/presentationTemplates';
import { PRESENTATION_THEMES, TRANSITIONS } from '../features/presentations/presentationThemes';

describe('presentation templates and layouts', () => {
	test('there are five layouts and each template points at things that exist', () => {
		expect(LAYOUT_IDS).toEqual(['classic', 'split', 'centered', 'banner', 'minimal']);
		const themes = PRESENTATION_THEMES.map((t) => t.id);
		const sections = REPORT_SECTIONS.map((s) => s.key);
		const transitions = TRANSITIONS.map((t) => t.id);
		expect(DECK_TEMPLATES.length).toBeGreaterThanOrEqual(6);
		for (const t of DECK_TEMPLATES) {
			expect(themes).toContain(t.theme);
			expect(LAYOUT_IDS).toContain(t.layout);
			expect(transitions).toContain(t.transition);
			expect(t.slides.length).toBeGreaterThan(0);
			for (const s of t.slides) expect(sections).toContain(s);
			expect(new Set(t.slides).size).toBe(t.slides.length); // a section appears once in a deck
		}
	});

	test('templates are different from each other, not just recoloured', () => {
		expect(new Set(DECK_TEMPLATES.map((t) => t.layout)).size).toBeGreaterThanOrEqual(4);
		expect(new Set(DECK_TEMPLATES.map((t) => t.slides.join('|'))).size).toBe(DECK_TEMPLATES.length);
		expect(new Set(DECK_TEMPLATES.map((t) => t.theme)).size).toBe(DECK_TEMPLATES.length);
	});

	test('lookups fall back safely', () => {
		expect(layoutById('nope').id).toBe('classic');
		expect(templateById('nope')).toBeNull();
		expect(templateById('board').layout).toBe('banner');
		expect(LAYOUTS.every((l) => l.label && l.description)).toBe(true);
	});
});
