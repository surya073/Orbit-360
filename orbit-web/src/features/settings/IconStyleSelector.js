import React from 'react';
import { useTheme } from '../../app/providers/ThemeProvider';
import Icon from '../../components/common/Icon';
import { ICON_PREVIEW, ICON_STYLES } from '../../config/icons';

/**
 * Icon style picker. Each tile draws real app icons in that style, so you choose by looking.
 * Applies immediately everywhere (header, buttons, cards) and is saved on this device.
 */
export default function IconStyleSelector({ compact = false }) {
	const { iconStyle, setIconStyle } = useTheme();

	const onKey = (e, i) => {
		const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
		if (!dir) return;
		e.preventDefault();
		const next = ICON_STYLES[(i + dir + ICON_STYLES.length) % ICON_STYLES.length];
		setIconStyle(next.id);
		document.getElementById(`iconstyle-${next.id}`).focus();
	};

	if (compact) {
		// text only: the tiles with a preview of six icons each made this screen busy
		return (
			<div className="astudio__chips" role="radiogroup" aria-label="Icon style">
				{ICON_STYLES.map((s) => (
					<button key={s.id} id={`iconstyle-${s.id}`} type="button" role="radio" aria-checked={iconStyle === s.id} tabIndex={iconStyle === s.id ? 0 : -1} className="achip" title={s.description} onClick={() => setIconStyle(s.id)}>
						{s.label}
					</button>
				))}
			</div>
		);
	}
	return (
		<div className="theme-grid" role="radiogroup" aria-label="Icon style">
			{ICON_STYLES.map((s, i) => (
				<button key={s.id} id={`iconstyle-${s.id}`} type="button" role="radio" aria-checked={iconStyle === s.id} tabIndex={iconStyle === s.id ? 0 : -1} className="theme-option icon-option" onClick={() => setIconStyle(s.id)} onKeyDown={(e) => onKey(e, i)}>
					<div className="icon-option__preview" aria-hidden="true">
						{ICON_PREVIEW.map((name) => (
							<Icon key={name} name={name} size={22} variant={s.id} />
						))}
					</div>
					<div className="theme-option__meta">
						<span>
							<b>{s.label}</b>
							<span className="small muted u-block">
								{s.description}
							</span>
						</span>
						{iconStyle === s.id ? <Icon name="check" size={16} className="theme-option__check" label="Selected" /> : null}
					</div>
				</button>
			))}
		</div>
	);
}
