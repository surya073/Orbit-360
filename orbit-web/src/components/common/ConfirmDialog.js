import React, { useState } from 'react';
import Button from './Button';
import Modal from './Modal';

/** Confirmation for destructive or sensitive actions (`confirmVariant` 'primary' for ones that are not destructive). `onConfirm` may be async; errors are shown inline. */
export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', confirmVariant = 'danger', onConfirm, onCancel }) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(null);
	const run = async () => {
		setBusy(true);
		setError(null);
		try {
			await onConfirm();
		} catch (e) {
			setError(e.message);
			setBusy(false);
		}
	};
	return (
		<Modal
			title={title}
			onClose={onCancel}
			dismissible={!busy}
			footer={
				<>
					<Button onClick={onCancel} disabled={busy} data-autofocus>
						Cancel
					</Button>
					<Button variant={confirmVariant} loading={busy} onClick={run}>
						{confirmLabel}
					</Button>
				</>
			}
		>
			<p>{message}</p>
			{error ? (
				<p role="alert" className="banner banner--error u-mt-3">
					{error}
				</p>
			) : null}
		</Modal>
	);
}
