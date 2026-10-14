import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Button from '../../components/common/Button';
import Logo from '../../components/common/Logo';
import LoadingState from '../../components/feedback/LoadingState';
import { ROUTES } from '../../config/routes';
import { useAuth } from '../providers/AuthProvider';

function Notice({ title, children, action }) {
	return (
		<main className="auth-page">
			<div className="card auth-card">
				<div style={{ marginBottom: 'var(--space-4)' }}>
					<Logo link={false} />
				</div>
				<h1 style={{ fontSize: 'var(--fs-lg)' }}>{title}</h1>
				<p className="banner banner--warning" role="alert" style={{ marginTop: 'var(--space-3)' }}>
					{children}
				</p>
				{action}
			</div>
		</main>
	);
}

/**
 * UX guard only: decides what to render, it does not protect data. Every API call is
 * authorized again by the backend from the Catalyst session.
 */
export function RequireAuth() {
	const { status, error, reload, signOut } = useAuth();
	const location = useLocation();
	if (status === 'checking') {
		return (
			<main className="auth-page">
				<div className="card auth-card">
					<LoadingState lines={2} label="Checking your session" />
				</div>
			</main>
		);
	}
	if (status === 'signedOut') return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
	if (status === 'denied') {
		return (
			<Notice title="Access not available" action={<Button onClick={signOut}>Sign out</Button>}>
				{error.message} Ask an administrator to add you to Company 360.
			</Notice>
		);
	}
	if (status === 'error') {
		return (
			<Notice
				title="Could not start the app"
				action={
					<Button variant="primary" icon="refresh" onClick={reload}>
						Try again
					</Button>
				}
			>
				{error.message}
			</Notice>
		);
	}
	return <Outlet />;
}

export function RequireRole({ roles }) {
	const { user } = useAuth();
	if (!roles.includes(user.role)) {
		return (
			<p className="banner banner--warning" role="alert">
				Your role does not have access to this page.
			</p>
		);
	}
	return <Outlet />;
}
