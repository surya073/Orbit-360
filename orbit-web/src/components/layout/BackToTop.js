import React, { useEffect, useState } from 'react';
import { motionReduced } from '../../utils/motion';
import Icon from '../common/Icon';

/** Floating "back to top" button once a long page has been scrolled; the page title, filters and tabs are one tap away again. */
export default function BackToTop({ shifted = false }) {
	const [show, setShow] = useState(false);
	useEffect(() => {
		const onScroll = () => setShow(window.scrollY > 700);
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	}, []);
	return (
		<button type="button" className={`to-top ${show ? 'is-visible' : ''} ${shifted ? 'to-top--clear-rail' : ''}`.replace(/\s+/g, ' ').trim()} aria-label="Back to top" tabIndex={show ? 0 : -1} aria-hidden={!show} onClick={() => window.scrollTo({ top: 0, behavior: motionReduced() ? 'auto' : 'smooth' })}>
			<Icon name="chevronDown" size={18} />
		</button>
	);
}
