import React from 'react';
import features from '../../config/features';
import Button from './Button';
import { useToast } from '../feedback/ToastProvider';

/**
 * Every place where an AI assistant would help uses this button. While AI is not connected (`features.aiAssist` is
 * false: it needs an AI provider key on the backend) pressing it explains that, in plain words, instead of doing nothing
 * or pretending; the same step is done with built-in rules. When AI is connected, `onRun` runs.
 */
export const AI_UNAVAILABLE = 'AI assistance is not switched on for this workspace. It needs an AI provider to be connected on the server, and each use would send the text involved to that provider. Until then this step uses built-in rules only.';

export default function AiButton({ children, onRun, feature, size = 'sm', ...rest }) {
	const { notify } = useToast();
	const run = () => {
		if (features.aiAssist && onRun) return onRun();
		return notify(`${feature ? `${feature}: ` : ''}${AI_UNAVAILABLE}`, 'warning', { title: 'AI is not connected' });
	};
	return (
		<Button size={size} variant="ghost" icon="sparkles" onClick={run} title={features.aiAssist ? undefined : 'AI is not connected'} {...rest}>
			{children} <span className="ai-badge">AI</span>
		</Button>
	);
}
