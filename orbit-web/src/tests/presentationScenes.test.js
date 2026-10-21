import { SCENES, SCENE_CHOICES, readStoredScene, sceneFor, storeScene } from '../features/presentations/presentationScenes';

beforeEach(() => window.localStorage.clear());

describe('presentation scenes', () => {
	test('Varied gives neighbouring slides different scenes and cycles through every scene', () => {
		const ids = SCENES.map((s) => s.id);
		const played = Array.from({ length: ids.length * 2 }, (_, i) => sceneFor('auto', i));
		expect(played.slice(0, ids.length)).toEqual(ids);
		expect(played.slice(ids.length)).toEqual(ids);
		played.slice(1).forEach((s, i) => expect(s).not.toBe(played[i]));
		expect(ids.length).toBeGreaterThanOrEqual(8);
	});

	test('a fixed scene is used for every slide, Off stays off, nonsense falls back to Varied', () => {
		expect(sceneFor('flip', 0)).toBe('flip');
		expect(sceneFor('flip', 5)).toBe('flip');
		expect(sceneFor('none', 3)).toBe('none');
		expect(sceneFor('bogus', 2)).toBe(SCENES[2].id);
		expect(sceneFor('auto', -1)).toBe(SCENES[0].id);
	});

	test('the choice is remembered on this device and bad stored values are ignored', () => {
		expect(readStoredScene()).toBe('auto');
		storeScene('curtain');
		expect(readStoredScene()).toBe('curtain');
		storeScene('not-a-scene');
		expect(readStoredScene()).toBe('curtain');
		window.localStorage.setItem('company360.presentationScene', 'garbage');
		expect(readStoredScene()).toBe('auto');
		expect(SCENE_CHOICES[0].id).toBe('auto');
		expect(SCENE_CHOICES[SCENE_CHOICES.length - 1].id).toBe('none');
	});
});
