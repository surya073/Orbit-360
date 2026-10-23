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

describe('story templates', () => {
	const { STORY_TEMPLATES, storyById, storySlides, readStoredStory, storeStory } = require('../features/presentations/presentationTemplates');
	const { SECTION_RENDERERS, SECTION_NEEDS } = require('../features/presentations/sections');

	test('there are five stories, each with an audience, a purpose and only slides the viewer can really render (no repeats)', () => {
		expect(STORY_TEMPLATES.map((s) => s.name)).toEqual(['Executive Overview', 'Team Performance Review', 'Project Portfolio Review', 'People and Reporting Structure', 'Comprehensive Meeting 360']);
		for (const s of STORY_TEMPLATES) {
			expect(s.audience.length).toBeGreaterThan(3);
			expect(s.purpose.length).toBeGreaterThan(20);
			expect(new Set(s.slides).size).toBe(s.slides.length);
			s.slides.forEach((k) => {
				if (k !== 'reporting_structure') expect(SECTION_RENDERERS[k]).toBeDefined(); // the viewer draws the reporting tree itself
				expect(SECTION_NEEDS[k]).toBeDefined();
			});
		}
	});

	test('a story carries no theme, layout or transition of its own, so it combines with any theme', () => {
		for (const s of STORY_TEMPLATES) expect(Object.keys(s)).not.toEqual(expect.arrayContaining(['theme']));
	});

	test('detail slides are only switched on for stories that show people, projects or the reporting tree', () => {
		expect(storyById('executive').detail).toEqual({ people: false, records: false, reporting: false });
		expect(storyById('team_performance').detail.people).toBe(true);
		expect(storyById('project_portfolio').detail.records).toBe(true);
		const pr = storyById('people_reporting');
		expect(pr.slides).toContain('reporting_structure');
		expect(pr.detail).toMatchObject({ people: true, reporting: true });
		// a detail option is only useful when its section is in the story
		for (const s of STORY_TEMPLATES) {
			if (s.detail.people) expect(s.slides).toContain('employee_overview');
			if (s.detail.records) expect(s.slides).toContain('project_performance');
			if (s.detail.reporting) expect(s.slides).toContain('reporting_structure');
		}
	});

	test('storySlides keeps the story order and drops slides the viewer may not load', () => {
		expect(storySlides(storyById('people_reporting')).map((s) => s.section)).toEqual(['employee_overview', 'reporting_structure', 'attendance_leave']);
		expect(storySlides(storyById('people_reporting'), (k) => k !== 'reporting_structure').map((s) => s.section)).toEqual(['employee_overview', 'attendance_leave']);
		expect(storySlides(storyById('executive'))[0]).toEqual({ type: 'section', section: 'executive_summary' });
	});

	test('the choice is remembered; an unknown stored value falls back to the saved deck', () => {
		window.localStorage.clear();
		expect(readStoredStory()).toBe('saved');
		storeStory('company_360');
		expect(readStoredStory()).toBe('company_360');
		storeStory('bogus');
		expect(readStoredStory()).toBe('company_360');
		window.localStorage.setItem('company360.presentationStory', 'bogus');
		expect(readStoredStory()).toBe('saved');
	});
});
