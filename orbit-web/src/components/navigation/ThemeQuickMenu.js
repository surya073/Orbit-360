import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../app/providers/ThemeProvider';
import { SYSTEM_THEME, THEMES } from '../../config/themes';
import { ROUTES } from '../../config/routes';
import { IconButton } from '../common/Button';
import Icon from '../common/Icon';
import Popover from '../common/Popover';

/** Quick theme switch from the header; the full selector with previews lives in Settings. */
export default function ThemeQuickMenu({ showSettingsLink = true }) {
	const { theme, setTheme } = useTheme();
	return (
		<Popover label="Appearance" trigger={({ toggle, props }) => <IconButton icon="palette" label="Appearance" onClick={toggle} {...props} />}>
			{({ close }) => (
				<div style={{ minWidth: 220 }} role="radiogroup" aria-label="Theme">
					{[...THEMES, SYSTEM_THEME].map((t) => (
						<button
							key={t.id}
							type="button"
							role="radio"
							aria-checked={theme === t.id}
							className="menu-item"
							onClick={() => {
								setTheme(t.id);
								close();
							}}
						>
							<span>{t.label}</span>
							{theme === t.id ? <Icon name="check" size={14} className="menu-check" /> : null}
						</button>
					))}
					{showSettingsLink ? (
						<>
							<div className="menu-sep" />
							<Link className="menu-item" to={`${ROUTES.settings}?tab=appearance`} onClick={close}>
								<Icon name="settings" size={15} />
								Appearance settings
							</Link>
						</>
					) : null}
				</div>
			)}
		</Popover>
	);
}
