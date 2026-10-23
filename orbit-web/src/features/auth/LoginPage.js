import React, { useCallback, useEffect, useState } from 'react';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import Logo from '../../components/common/Logo';
import LoadingState from '../../components/feedback/LoadingState';
import { authService } from '../../services/authService';
import LoginBotanical, { LoginBackdrop } from './LoginBotanical';
import useIframeHeight from './useIframeHeight';
import './login.css';

/** The hosted sign-in and forgot-password pages are styled with one fixed light, botanical sheet (see scripts/generate-login-css.js). */
export const LOGIN_SKIN = 'botanical';

/** Same-origin stylesheets for the hosted pages (the iframe cannot read our CSS variables). */
export const loginCssPath = (skin = LOGIN_SKIN) => new URL(`auth/login-iframe-${skin}.css`, window.location.href).pathname;
export const forgotCssPath = (skin = LOGIN_SKIN) => new URL(`auth/forgot-iframe-${skin}.css`, window.location.href).pathname;

const delay = (ms) => ({ '--d': `${ms}ms` });

/**
 * Sign-in, after UI_Design/b4492ab0...jpg: one white card, the form on the left, paper-cut foliage on the right (a frosted
 * panel over the foliage on phones). The form and the forgot-password flow are Catalyst's hosted pages (we never handle
 * credentials). The card grows/shrinks with the hosted content, so the page never needs an inner scrollbar. The login page
 * keeps its own light colours whatever theme the app uses.
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
			<LoginBackdrop />
			<main className="login__stage">
				<section className="login__card" aria-labelledby="signin-title">
					<div className="login__art" aria-hidden="true">
						<LoginBotanical />
					</div>
					<div className="login__panel">
						<div className="login__brand reveal" style={delay(60)}>
							<Logo link={false} />
						</div>
						<h1 id="signin-title" className="reveal" style={delay(120)}>
							Sign in
						</h1>
						<p className="sub reveal" style={delay(180)}>
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

						<div className="login__form reveal" style={{ ...delay(240), height: state.status === 'ready' ? formHeight : undefined }} aria-busy={state.status === 'loading'}>
							{state.status === 'loading' ? (
								<div className="login__skeleton">
									<LoadingState height={14} label="Loading sign-in" />
									<div className="skeleton skeleton--field" />
									<div className="skeleton skeleton--field" />
								</div>
							) : null}
							<div id="login-container" className="login-frame" />
						</div>

						<p className="login__help reveal" style={delay(320)}>
							<Icon name="lock" size={13} />
							<span>Access is by invitation. If you can sign in but see “Access not available”, ask an administrator to add you to Meeting 360.</span>
						</p>
					</div>
				</section>
				<p className="login__foot reveal" style={delay(400)}>
					© Meeting 360 · Internal use only
				</p>
			</main>
		</div>
	);
}
