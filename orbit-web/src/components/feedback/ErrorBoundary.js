import React from 'react';
import Button from '../common/Button';
import Icon from '../common/Icon';

/**
 * A page that throws while drawing shows this instead of taking the whole app (sidebar included) to a blank screen.
 * `resetKey` (the page address) clears the error when the user moves or changes a filter. Only the error name is
 * shown, never data, because messages can carry row values.
 */
export default class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { failed: false };
	}

	static getDerivedStateFromError() {
		return { failed: true };
	}

	componentDidUpdate(prev) {
		if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
	}

	render() {
		if (!this.state.failed) return this.props.children;
		return (
			<div className="state state--error" role="alert">
				<span className="state__icon">
					<Icon name="alert" size={18} />
				</span>
				<div className="state__title">This page could not be drawn</div>
				<p>Something unexpected happened while showing this page. Your data is safe. Try again, or go back and change the selection.</p>
				<Button size="sm" icon="refresh" onClick={() => this.setState({ failed: false })}>Try again</Button>
			</div>
		);
	}
}
