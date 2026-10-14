import env from '../config/env';

/**
 * Integrates Catalyst Authentication through the Catalyst Web SDK. The SDK and its
 * session cookie are provided by Catalyst hosting (and `catalyst serve` locally); this app
 * never stores tokens. The application role/team come from the backend (/me).
 */
function waitForSdk(timeoutMs = env.sdkWaitMs) {
	return new Promise((resolve, reject) => {
		const start = Date.now();
		(function poll() {
			if (window.catalyst && window.catalyst.auth) return resolve(window.catalyst);
			if (Date.now() - start > timeoutMs) {
				return reject(new Error('The Catalyst SDK did not load. Run the app through "catalyst serve" or the deployed URL.'));
			}
			setTimeout(poll, 100);
		})();
	});
}

const returnUrl = () => window.location.origin + window.location.pathname;

export const authService = {
	/** Resolves true when a Catalyst session exists, false when signed out. */
	async isSignedIn() {
		const catalyst = await waitForSdk();
		try {
			await catalyst.auth.isUserAuthenticated();
			return true;
		} catch {
			// Web SDK 4.x rejects when there is no session: it maps the 401 to the generic message
			// "Some network issue occured!", so the error text cannot be used to tell the cases
			// apart. Treat any rejection as "not signed in" (fail closed): the login page shows,
			// and a genuine outage then surfaces on the next API call.
			return false;
		}
	},
	/** cssUrl / forgotCssUrl: same-origin stylesheets applied inside the hosted sign-in and forgot-password pages (theme matching). */
	async renderLogin(containerId, { cssUrl, forgotCssUrl } = {}) {
		const catalyst = await waitForSdk();
		catalyst.auth.signIn(containerId, { login_redirect: returnUrl(), ...(cssUrl ? { css_url: cssUrl } : {}), ...(forgotCssUrl ? { forgot_password_css_url: forgotCssUrl } : {}) });
	},
	async signOut() {
		const catalyst = await waitForSdk();
		catalyst.auth.signOut(returnUrl());
	},
};
