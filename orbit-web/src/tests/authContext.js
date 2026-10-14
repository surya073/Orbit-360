import React from 'react';
import { useAuth } from '../app/providers/AuthProvider';

// Test-only: supplies a ready AuthProvider-compatible value without the Catalyst SDK.
// Implemented by mocking the SDK-facing services in tests that need real AuthProvider behaviour.
import { AuthProvider } from '../app/providers/AuthProvider';
import { authService } from '../services/authService';
import { sessionService } from '../services/sessionService';

/** Wraps children in the real AuthProvider, with auth/session services stubbed to return `user`. */
export function AuthContextForTests({ user, children }) {
	authService.isSignedIn = () => Promise.resolve(true);
	authService.signOut = authService.signOut.mock ? authService.signOut : jest.fn();
	sessionService.me = () => Promise.resolve({ data: user });
	return (
		<AuthProvider>
			<Ready>{children}</Ready>
		</AuthProvider>
	);
}

function Ready({ children }) {
	const { status } = useAuth();
	return status === 'ready' ? children : null;
}
