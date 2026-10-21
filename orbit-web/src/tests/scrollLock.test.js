import { isScrollLocked, lockScroll } from '../utils/scrollLock';

describe('page scroll lock', () => {
	beforeEach(() => {
		window.scrollTo = jest.fn();
	});

	test('locks html and body, and a second lock keeps the page locked until the last one is released', () => {
		const a = lockScroll();
		expect(document.documentElement.style.overflow).toBe('hidden');
		expect(document.body.style.overflow).toBe('hidden');
		expect(document.body.style.position).toBe('fixed');
		const b = lockScroll();
		a();
		expect(isScrollLocked()).toBe(true);
		expect(document.body.style.overflow).toBe('hidden');
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

	test('the scroll position from before the lock is restored', () => {
		Object.defineProperty(window, 'scrollY', { value: 340, configurable: true });
		const release = lockScroll();
		expect(document.body.style.top).toBe('-340px');
		release();
		expect(window.scrollTo).toHaveBeenCalledWith({ top: 340, left: 0, behavior: 'instant' });
		expect(document.body.style.top).toBe('');
		Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
	});
});
