import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../../services/authService';
import { sessionService } from '../../services/sessionService';

const AuthContext = createContext(null);

/**
 * status: 'checking' | 'signedOut' | 'ready' | 'denied' | 'error'
 *  denied = signed in with Catalyst but not provisioned/active in Company 360 (403 from /me).
 * The user object (role, teamId) always comes from the backend; nothing is invented here.
 */
export function AuthProvider({ children }) {
	const [state, setState] = useState({ status: 'checking', user: null, error: null });

	const load = useCallback(async () => {
		setState({ status: 'checking', user: null, error: null });
		try {
			if (!(await authService.isSignedIn())) return setState({ status: 'signedOut', user: null, error: null });
			const { data } = await sessionService.me();
			setState({ status: 'ready', user: data, error: null });
		} catch (error) {
			if (error && error.status === 401) return setState({ status: 'signedOut', user: null, error: null });
			if (error && error.status === 403) return setState({ status: 'denied', user: null, error });
			setState({ status: 'error', user: null, error });
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const value = useMemo(() => ({ ...state, reload: load, signOut: () => authService.signOut() }), [state, load]);
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used within AuthProvider');
	return ctx;
}
