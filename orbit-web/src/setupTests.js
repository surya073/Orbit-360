import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { clearApiCache, readPolicy } from './services/apiClient';

// Full-suite runs share CPU across parallel workers; the 1s default makes slow-but-correct renders flaky.
configure({ asyncUtilTimeout: 4000 });
// ...and the same goes for a whole test: the 5 s default is too tight for the heaviest pages (themes gallery, launcher, editor) in a full run.
jest.setTimeout(20000);

// jsdom has no matchMedia; tests default to a light, motion-allowed device. Individual tests
// override window.matchMedia (see tests/themes.test.js) to simulate dark mode.
readPolicy.retries = 0; // tests assert on the first failure; retry behaviour has its own test
readPolicy.maxParallel = 100;
beforeEach(() => {
	clearApiCache(); // the app keeps a short read cache; tests must never see another test's responses
	window.localStorage.clear();
	window.localStorage.setItem('company360.tour.v1', 'seen'); // the first-visit welcome tour has its own tests
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
