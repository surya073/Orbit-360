import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import TourExperience from '../../components/tour/TourExperience';
import { buildSteps, hasSeenTour, markTourSeen } from '../../config/tour';
import { useAuth } from './AuthProvider';

const TourContext = createContext({ start: () => {}, running: false });

/**
 * The guided tour. It is offered once per device on the first visit (a welcome screen; skipping it is
 * remembered), and can be replayed any time from the account menu. The steps follow the user's
 * permissions, so nobody is shown a part of the app they cannot open.
 */
export function TourProvider({ children }) {
	const { user, can } = useAuth();
	const [mode, setMode] = useState(null); // null | 'welcome' | 'steps'
	const [index, setIndex] = useState(0);
	const steps = useMemo(() => buildSteps(can), [can]);

	const close = useCallback(() => {
		markTourSeen();
		setMode(null);
		setIndex(0);
	}, []);
	const begin = useCallback(() => {
		setIndex(0);
		setMode('steps');
	}, []);
	const start = useCallback(() => {
		setIndex(0);
		setMode('welcome');
	}, []);

	useEffect(() => {
		if (!user || hasSeenTour()) return undefined;
		const t = setTimeout(() => setMode((m) => m || 'welcome'), 700); // let the page settle first
		return () => clearTimeout(t);
	}, [user]);

	const value = useMemo(() => ({ start, running: mode !== null }), [start, mode]);
	return (
		<TourContext.Provider value={value}>
			{children}
			{mode ? <TourExperience mode={mode} steps={steps} index={index} setIndex={setIndex} user={user} onBegin={begin} onClose={close} /> : null}
		</TourContext.Provider>
	);
}

export const useTour = () => useContext(TourContext);
