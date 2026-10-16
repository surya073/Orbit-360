import React from 'react';
import ReactDOM from 'react-dom/client';
// Self-hosted variable fonts (DM Sans for UI, Manrope for headings/KPIs); the CSS stacks fall
// back to system fonts if these files cannot load.
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './styles/tokens.css';
import './styles/themes.css';
import './styles/global.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/controls.css';
import './styles/settings.css';
import './styles/spreadsheet.css';
import './styles/reporting.css';
import './styles/access.css';
import './styles/signature.css';
import './styles/dashEntrance.css';
import './styles/reveal.css';
import './styles/employeeCard.css';
import './styles/import.css';
import './styles/themes.extra.css';
import './styles/bento.css';
import './styles/appearance.css';
import './styles/ux.css';
import './styles/module.css';
import './styles/rail.css';
import './styles/tour.css';
import './styles/presentations.css';
import './styles/reportingSlide.css';
import './styles/dashboard.css';
import App from './app/App';

ReactDOM.createRoot(document.getElementById('root')).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
);
