import { useEffect } from 'react';

const MESSAGE = 'You have unsaved changes. Leave this page and discard them?';

/**
 * Protects unsaved work. Closing/refreshing the tab triggers the browser's own prompt; clicking an
 * in-app link asks for confirmation first. (Browser back/forward cannot be intercepted with
 * HashRouter, so the page also shows a persistent "unsaved changes" indicator.)
 */
export default function useUnsavedGuard(dirty) {
	useEffect(() => {
		if (!dirty) return undefined;
		const beforeUnload = (e) => {
			e.preventDefault();
			e.returnValue = '';
		};
		const onClick = (e) => {
			const a = e.target.closest && e.target.closest('a[href]');
			if (!a || a.target === '_blank' || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
			const href = a.getAttribute('href') || '';
			if (!href.startsWith('#/') && !href.startsWith('/')) return;
			if (!window.confirm(MESSAGE)) {
				e.preventDefault();
				e.stopPropagation();
			}
		};
		window.addEventListener('beforeunload', beforeUnload);
		document.addEventListener('click', onClick, true); // capture: runs before the router's own handler
		return () => {
			window.removeEventListener('beforeunload', beforeUnload);
			document.removeEventListener('click', onClick, true);
		};
	}, [dirty]);
}
