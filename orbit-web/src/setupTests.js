import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { clearApiCache } from './services/apiClient';

// Full-suite runs share CPU across parallel workers; the 1s default makes slow-but-correct renders flaky.
configure({ asyncUtilTimeout: 4000 });

// jsdom has no matchMedia; tests default to a light, motion-allowed device. Individual tests
// override window.matchMedia (see tests/themes.test.js) to simulate dark mode.
beforeEach(() => {
	clearApiCache(); // the app keeps a short read cache; tests must never see another test's responses
	window.localStorage.clear();
	document.documentElement.removeAttribute('data-theme');
	document.documentElement.removeAttribute('data-density');
	window.matchMedia = (query) => ({
		matches: false,
		media: query,
		addEventListener() {},
		removeEventListener() {},
		addListener() {},
		removeListener() {},
	});
});
