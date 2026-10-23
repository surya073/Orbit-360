import { isScrollLocked, lockScroll } from '../utils/scrollLock';

describe('page scroll lock', () => {
	beforeEach(() => {
		window.scrollTo = jest.fn();
	});

	test('locks the page (html only), and a second lock keeps the page locked until the last one is released', () => {
		const a = lockScroll();
		expect(document.documentElement.style.overflow).toBe('hidden');
		expect(document.body.style.overflow).toBe(''); // the body stays a plain block so the sticky sidebar keeps working
		expect(document.body.style.position).toBe(''); // never pinned: that would carry the sticky sidebar and header with it
		const b = lockScroll();
		a();
		expect(isScrollLocked()).toBe(true);
		expect(document.documentElement.style.overflow).toBe('hidden');
		b();
		expect(isScrollLocked()).toBe(false);
		expect(document.documentElement.style.overflow).toBe('');
		expect(document.body.style.overflow).toBe('');
		expect(document.body.style.position).toBe('');
	});

	test('releasing the same lock twice never unlocks somebody else’s lock', () => {
		const a = lockScroll();
		const b = lockScroll();
		a();
		a();
		expect(isScrollLocked()).toBe(true);
		b();
		expect(isScrollLocked()).toBe(false);
	});

	test('the scroll position is kept: nothing moves while locked, and it is put back if the browser moved it', () => {
		Object.defineProperty(window, 'scrollY', { value: 340, configurable: true });
		const release = lockScroll();
		expect(document.body.style.top).toBe(''); // the page is not shifted
		expect(window.scrollTo).not.toHaveBeenCalled();
		Object.defineProperty(window, 'scrollY', { value: 0, configurable: true }); // something reset it meanwhile
		release();
		expect(window.scrollTo).toHaveBeenCalledWith({ top: 340, left: 0, behavior: 'instant' });
	});
});
