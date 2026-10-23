import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../../app/providers/ThemeProvider';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import Logo from '../../components/common/Logo';
import LoadingState from '../../components/feedback/LoadingState';
import ThemeQuickMenu from '../../components/navigation/ThemeQuickMenu';
import { authService } from '../../services/authService';
import LoginArt from './LoginArt';
import useIframeHeight from './useIframeHeight';
import './login.css';

const POINTS = [
	{ icon: 'clock', title: 'Numbers you can trust', text: 'Only approved time counts, and gaps in the data are shown, never hidden as zero.' },
	{ icon: 'users', title: 'Scoped to your team', text: 'Managers see their own team. Administrators see the whole company.' },
	{ icon: 'present', title: 'Ready for the boardroom', text: 'Save an executive presentation and present it live from current data.' },
];

/** Same-origin stylesheets for the hosted pages, per theme (see scripts/generate-login-css.js). */
export const loginCssPath = (theme) => new URL(`auth/login-iframe-${theme}.css`, window.location.href).pathname;
export const forgotCssPath = (theme) => new URL(`auth/forgot-iframe-${theme}.css`, window.location.href).pathname;

const delay = (ms) => ({ '--d': `${ms}ms` });

/**
 * Sign-in. The form and the forgot-password flow are Catalyst's hosted pages (we never handle
 * credentials). Both are styled per theme and re-rendered when the theme changes, since an iframe
 * cannot read our CSS variables. The card grows/shrinks with the hosted content, so the page never
 * needs an inner scrollbar.
 */
export default function LoginPage() {
	const { resolved } = useTheme();
	const [state, setState] = useState({ status: 'loading', error: null });
	const [attempt, setAttempt] = useState(0);
	const formHeight = useIframeHeight('login-container', { enabled: state.status === 'ready' });

	useEffect(() => {
		let live = true;
		setState({ status: 'loading', error: null });
		authService
			.renderLogin('login-container', { cssUrl: loginCssPath(resolved), forgotCssUrl: forgotCssPath(resolved) })
			.then(() => live && setState({ status: 'ready', error: null }))
			.catch((e) => live && setState({ status: 'error', error: e.message }));
		return () => {
			live = false;
		};
	}, [resolved, attempt]);

	const retry = useCallback(() => setAttempt((n) => n + 1), []);

	return (
		<div className="login">
			<aside className="login__brand" aria-label="About Company 360">
				<span className="login__orb login__orb--a" aria-hidden="true" />
				<span className="login__orb login__orb--b" aria-hidden="true" />
				<div className="login__brand-top">
					<div className="reveal" style={delay(0)}>
						<Logo link={false} />
					</div>
					<p className="login__tag reveal" style={delay(80)}>
						<Icon name="sparkles" size={13} /> Internal analytics workspace
					</p>
					<h2 className="login__headline reveal" style={delay(160)}>
						<span>One clear view</span> of your people, projects and hours.
					</h2>
					<p className="login__lead reveal" style={delay(240)}>
						Company 360 brings time, attendance, leave, delivery and tool usage into one workspace for leadership and team managers.
					</p>
					<ul className="login__points">
						{POINTS.map((p, i) => (
							<li key={p.title} className="reveal" style={delay(320 + i * 90)}>
								<span className="ico">
									<Icon name={p.icon} size={16} />
								</span>
								<div>
									<b>{p.title}</b>
									<span>{p.text}</span>
								</div>
							</li>
						))}
					</ul>
				</div>
				<div className="login__art-wrap reveal" style={delay(560)}>
					<LoginArt />
				</div>
				<p className="login__foot reveal" style={delay(640)}>
					© Company 360 · Internal use only
				</p>
			</aside>

			<main className="login__main">
				<div className="login__top reveal" style={delay(100)}>
					<span className="u-grow" />
					<ThemeQuickMenu showSettingsLink={false} />
				</div>
				<div className="login__center">
					<section className="card login__card" aria-labelledby="signin-title">
						<h1 id="signin-title">Sign in</h1>
						<p className="sub">Use your company account to continue.</p>

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

						<div className="login__form" aria-busy={state.status === 'loading'} style={{ height: state.status === 'ready' ? formHeight : undefined }}>
							{state.status === 'loading' ? (
								<div className="login__skeleton">
									<LoadingState height={14} label="Loading sign-in" />
									<div className="skeleton skeleton--field" />
									<div className="skeleton skeleton--field" />
								</div>
							) : null}
							<div id="login-container" className="login-frame" />
						</div>

						<p className="login__help">
							<Icon name="lock" size={13} />
							<span>Access is by invitation. If you can sign in but see “Access not available”, ask an administrator to add you to Company 360.</span>
						</p>
					</section>
				</div>
			</main>
		</div>
	);
}
