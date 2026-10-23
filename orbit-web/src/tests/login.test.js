import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../app/providers/ThemeProvider';
import { THEME_IDS } from '../config/themes';
import LoginPage, { forgotCssPath, loginCssPath } from '../features/auth/LoginPage';
import useIframeHeight from '../features/auth/useIframeHeight';
import { authService } from '../services/authService';

jest.mock('../services/authService', () => ({ authService: { renderLogin: jest.fn(), isSignedIn: jest.fn(), signOut: jest.fn() } }));

const renderLogin = () =>
	render(
		<ThemeProvider>
			<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
				<LoginPage />
			</MemoryRouter>
		</ThemeProvider>
	);

beforeEach(() => authService.renderLogin.mockResolvedValue());

const options = (theme) => ({ cssUrl: expect.stringMatching(new RegExp(`/auth/login-iframe-${theme}\\.css$`)), forgotCssUrl: expect.stringMatching(new RegExp(`/auth/forgot-iframe-${theme}\\.css$`)) });

describe('sign-in page', () => {
	test('shows the sign-in card and the access note (no marketing panel: the form and the artwork are the page)', async () => {
		renderLogin();
		expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
		expect(screen.getByText(/Access is by invitation/)).toBeInTheDocument();
		expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
		await waitFor(() => expect(authService.renderLogin).toHaveBeenCalled());
	});

	test('both hosted pages (sign-in and forgot password) get the fixed meeting stylesheet', async () => {
		renderLogin();
		await waitFor(() => expect(authService.renderLogin).toHaveBeenCalledWith('login-container', options('meeting')));
		expect(document.getElementById('login-container')).toBeInTheDocument();
	});

	test('the sign-in page keeps its own look when the app theme changes (no theme menu, no re-render of the hosted form)', async () => {
		renderLogin();
		await waitFor(() => expect(authService.renderLogin).toHaveBeenCalledTimes(1));
		expect(screen.queryByRole('button', { name: 'Appearance' })).not.toBeInTheDocument();
		act(() => {
			document.documentElement.dataset.theme = 'blackcurrant';
		});
		await new Promise((r) => setTimeout(r, 30));
		expect(authService.renderLogin).toHaveBeenCalledTimes(1);
	});

	test('an SDK failure is explained with a retry that renders the form again', async () => {
		authService.renderLogin.mockRejectedValueOnce(new Error('The Catalyst SDK did not load. Run the app through "catalyst serve" or the deployed URL.'));
		renderLogin();
		expect(await screen.findByRole('alert')).toHaveTextContent(/Catalyst SDK did not load/);
		await userEvent.click(screen.getByRole('button', { name: /try again/i }));
		await waitFor(() => expect(authService.renderLogin).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
	});

	test('shows a loading placeholder (not an empty card) until the form is attached', async () => {
		let release;
		authService.renderLogin.mockReturnValueOnce(new Promise((r) => (release = r)));
		renderLogin();
		expect(screen.getByRole('status', { name: 'Loading sign-in' })).toBeInTheDocument();
		release();
		await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading sign-in' })).not.toBeInTheDocument());
	});

	test('stylesheet paths are resolved next to the app, per theme', () => {
		expect(loginCssPath('sunset')).toMatch(/\/auth\/login-iframe-sunset\.css$/);
		expect(forgotCssPath('sunset')).toMatch(/\/auth\/forgot-iframe-sunset\.css$/);
	});

	test('the artwork is decorative: hidden from assistive technology', () => {
		renderLogin();
		expect(document.querySelector('.login__art')).toHaveAttribute('aria-hidden', 'true');
		expect(document.querySelector('.login-illu')).toHaveAttribute('aria-hidden', 'true');
		expect(document.querySelector('.login-backdrop')).toHaveAttribute('aria-hidden', 'true');
		expect(document.querySelectorAll('.reveal').length).toBeGreaterThanOrEqual(5);
	});
});

describe('auto-sizing the hosted card', () => {
	function Probe({ enabled = true }) {
		const h = useIframeHeight('probe-container', { enabled, fallback: 300, interval: 20 });
		return (
			<>
				<div id="probe-container" />
				<output data-testid="h">{h}</output>
			</>
		);
	}
	// jsdom has no layout, so each element's box is supplied. `contentBottom` = bottom edge of the
	// lowest visible leaf; `bodyHeight` is what the (possibly stretched) body would report.
	const mountFrame = (contentBottom, { bodyHeight = 0 } = {}) => {
		const frame = document.createElement('iframe');
		document.getElementById('probe-container').appendChild(frame);
		const d = frame.contentDocument;
		d.body.innerHTML = '<div id="wrap"><input id="field"><span id="hidden"></span><div id="bg"></div></div>';
		const box = (el, rect) => Object.defineProperty(el, 'getBoundingClientRect', { value: () => rect, configurable: true });
		const field = d.getElementById('field');
		box(d.body, { width: 400, height: bodyHeight, bottom: bodyHeight });
		box(d.getElementById('wrap'), { width: 400, height: bodyHeight, bottom: bodyHeight });
		box(d.getElementById('hidden'), { width: 0, height: 0, bottom: 0 }); // empty: ignored
		box(d.getElementById('bg'), { width: 400, height: 9999, bottom: 9999 }); // fixed backdrop: ignored
		d.getElementById('bg').style.position = 'fixed';
		const set = (b) => box(field, { width: 300, height: 40, bottom: b });
		set(contentBottom);
		return { frame, set, d };
	};

	test('the card follows the hosted CONTENT (not the stretched body) as steps change, clamped to a sensible range', async () => {
		render(<Probe />);
		expect(screen.getByTestId('h')).toHaveTextContent('300'); // fallback until a frame exists
		const { set } = mountFrame(200, { bodyHeight: 800 }); // body stretched far beyond its content
		await waitFor(() => expect(screen.getByTestId('h')).toHaveTextContent('220')); // 200 content + 20 slack
		set(500);
		await waitFor(() => expect(screen.getByTestId('h')).toHaveTextContent('520'));
		set(5000);
		await waitFor(() => expect(screen.getByTestId('h')).toHaveTextContent('640')); // max
		set(30);
		await waitFor(() => expect(screen.getByTestId('h')).toHaveTextContent('140')); // min
	});

	test('REGRESSION: a body that stretches to the iframe height must not make the card grow tick after tick', async () => {
		render(<Probe />);
		const { frame, set } = mountFrame(190);
		// the hosted body reports the frame's own height (height: 100%), which follows the card height
		const body = frame.contentDocument.body;
		Object.defineProperty(body, 'getBoundingClientRect', { value: () => ({ width: 400, height: parseFloat(document.getElementById('probe-container').style.height) || 300, bottom: 0 }), configurable: true });
		document.getElementById('probe-container').style.height = '300px';
		await waitFor(() => expect(screen.getByTestId('h')).toHaveTextContent('210'));
		await new Promise((r) => setTimeout(r, 200)); // ~10 more measurement ticks
		expect(screen.getByTestId('h')).toHaveTextContent('210'); // stable, not 230, 250, ... 640
		set(190);
	});

	test('measuring is skipped while disabled', async () => {
		render(<Probe enabled={false} />);
		mountFrame(500);
		await new Promise((r) => setTimeout(r, 80));
		expect(screen.getByTestId('h')).toHaveTextContent('300');
	});
});

describe('generated iframe stylesheets', () => {
	const themes = fs.readFileSync(path.join(__dirname, '../styles/themes.css'), 'utf8') + fs.readFileSync(path.join(__dirname, '../styles/themes.extra.css'), 'utf8');
	const token = (id, name) => {
		const re = id === 'blueberry' ? /:root,\s*\[data-theme='blueberry'\]\s*\{([^}]*)\}/ : new RegExp(`\\[data-theme='${id}'\\]\\s*\\{([^}]*)\\}`);
		return new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(re.exec(themes)[1])[1];
	};
	const BASE = { login: 'embedded_signin.css', forgot: 'embedded_password_reset.css' };

	test.each(THEME_IDS)('%s: sign-in and forgot-password sheets keep the platform base and match the theme (run npm run gen:login-css if this fails)', (id) => {
		for (const kind of ['login', 'forgot']) {
			const css = fs.readFileSync(path.join(__dirname, `../../public/auth/${kind}-iframe-${id}.css`), 'utf8');
			for (const name of ['surface', 'text', 'accent', 'accent-contrast', 'border-strong', 'danger']) {
				expect(css.toLowerCase()).toContain(token(id, name).toLowerCase());
			}
			// passing css_url would otherwise REPLACE Catalyst's own base stylesheet entirely
			expect(css.startsWith(`@import url("/__catalyst/auth/static-file?file_name=${BASE[kind]}");`)).toBe(true);
			expect(css).toContain('.textbox');
		}
		expect(fs.readFileSync(path.join(__dirname, `../../public/auth/forgot-iframe-${id}.css`), 'utf8')).toContain('.recovery_container');
	});
});

describe('meeting hosted-form stylesheets', () => {
	test.each(['login', 'forgot'])('%s sheet keeps the platform base and gives rectangular fields and a blue button with an arrow end', (kind) => {
		const css = fs.readFileSync(path.join(__dirname, `../../public/auth/${kind}-iframe-meeting.css`), 'utf8');
		expect(css.startsWith(`@import url("/__catalyst/auth/static-file?file_name=${kind === 'login' ? 'embedded_signin.css' : 'embedded_password_reset.css'}");`)).toBe(true);
		expect(css).toContain('border-radius: 4px');
		expect(css.toLowerCase()).toContain('#5b7cfa');
		expect(css).toContain('.textbox');
	});
});
