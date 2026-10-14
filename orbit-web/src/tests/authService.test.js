import { authService } from '../services/authService';

afterEach(() => {
	delete window.catalyst;
});

test('signed in when the SDK confirms a session', async () => {
	window.catalyst = { auth: { isUserAuthenticated: () => Promise.resolve({ status: 200 }) } };
	await expect(authService.isSignedIn()).resolves.toBe(true);
});

test('the SDK rejects with a generic "network issue" message when signed out: that means signed out, not an app error', async () => {
	window.catalyst = { auth: { isUserAuthenticated: () => Promise.reject(new Error('Some network issue occured!')) } };
	await expect(authService.isSignedIn()).resolves.toBe(false);
});

test('a missing SDK is reported as an error (it cannot be mistaken for signed out)', async () => {
	await expect(authService.isSignedIn()).rejects.toThrow(/Catalyst SDK did not load/);
}, 15000);
