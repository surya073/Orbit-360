import React, { useCallback, useEffect, useState } from 'react';
import illustration from '../../assets/images/login-orbit.svg';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import Logo from '../../components/common/Logo';
import LoadingState from '../../components/feedback/LoadingState';
import { authService } from '../../services/authService';
import useIframeHeight from './useIframeHeight';
import './login.css';

/** The hosted sign-in and forgot-password pages are styled with one fixed light "meeting" sheet (see scripts/generate-login-css.js). */
export const LOGIN_SKIN = 'meeting';

/** Same-origin stylesheets for the hosted pages (the iframe cannot read our CSS variables). */
export const loginCssPath = (skin = LOGIN_SKIN) => new URL(`auth/login-iframe-${skin}.css`, window.location.href).pathname;
export const forgotCssPath = (skin = LOGIN_SKIN) => new URL(`auth/forgot-iframe-${skin}.css`, window.location.href).pathname;

const delay = (ms) => ({ '--d': `${ms}ms` });

/**
 * Sign-in: a white page with one card. The left panel shows the Orbit illustration (src/assets/images/login-orbit.svg,
 * from UI_Design/login page.png) and a short line about the product; the right holds the form. The form and the
 * forgot-password flow are Catalyst's hosted pages (we never handle credentials). The card grows/shrinks with the hosted
 * content, so the page never needs an inner scrollbar. The login page keeps its own light colours whatever theme the app
 * uses, and stacks (illustration above the form) on narrow screens.
 */
export default function LoginPage() {
	const [state, setState] = useState({ status: 'loading', error: null });
	const [attempt, setAttempt] = useState(0);
	const formHeight = useIframeHeight('login-container', { enabled: state.status === 'ready' });

	useEffect(() => {
		let live = true;
		setState({ status: 'loading', error: null });
		authService
			.renderLogin('login-container', { cssUrl: loginCssPath(), forgotCssUrl: forgotCssPath() })
			.then(() => live && setState({ status: 'ready', error: null }))
			.catch((e) => live && setState({ status: 'error', error: e.message }));
		return () => {
			live = false;
		};
	}, [attempt]);

	const retry = useCallback(() => setAttempt((n) => n + 1), []);

	return (
		<div className="login">
			<main className="login__stage">
				<section className="login__card" aria-labelledby="signin-title">
					<div className="login__art" aria-hidden="true">
						<img className="login__img" src={illustration} alt="" width="360" height="360" draggable="false" />
						<div className="login__pitch">
							<b>Every metric, one clear orbit.</b>
							<span>Hours, attendance, leave and delivery for your team, from approved data.</span>
						</div>
					</div>
					<div className="login__panel">
						<div className="login__brand reveal" style={delay(40)}>
							<Logo link={false} />
						</div>
						<h1 id="signin-title" className="reveal" style={delay(100)}>
							Sign in
						</h1>
						<p className="sub reveal" style={delay(160)}>
							Use your company account to continue.
						</p>

						{state.status === 'error' ? (
							<div role="alert" className="banner banner--error login-error">
								<span>{state.error}</span>
								<span>
									<Button size="sm" icon="refresh" onClick={retry}>
										Try again
									</Button>
								</span>
							</div>
						) : null}

						<div className="login__form reveal" style={{ ...delay(220), height: state.status === 'ready' ? formHeight : undefined }} aria-busy={state.status === 'loading'}>
							{state.status === 'loading' ? (
								<div className="login__skeleton">
									<LoadingState height={14} label="Loading sign-in" />
									<div className="skeleton skeleton--field" />
									<div className="skeleton skeleton--field" />
								</div>
							) : null}
							<div id="login-container" className="login-frame" />
						</div>

						<p className="login__help reveal" style={delay(300)}>
							<Icon name="lock" size={13} />
							<span>Access is by invitation. If you can sign in but see “Access not available”, ask an administrator to add you to Orbit 360.</span>
						</p>
					</div>
				</section>
				<p className="login__foot reveal" style={delay(380)}>
					© Orbit 360 · Internal use only
				</p>
			</main>
		</div>
	);
}
