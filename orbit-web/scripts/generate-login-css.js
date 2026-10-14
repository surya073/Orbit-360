// Usage: npm run gen:login-css
// Writes public/auth/login-iframe-<theme>.css (sign-in) and public/auth/forgot-iframe-<theme>.css
// (forgot password) from src/styles/themes.css.
//
// Catalyst's hosted auth pages live in an iframe: they cannot read our CSS variables, and each loads
// ONE stylesheet. Passing css_url / forgot_password_css_url to catalyst.auth.signIn REPLACES
// Catalyst's own sheet, so every generated file first @imports the platform default (staying in sync
// with platform changes) and then layers only (1) layout that fits the page into our card and
// (2) theme colors. Selectors come from the real embedded_signin.css / embedded_password_reset.css
// and the hosted reset page: .signin_container/.signin_box, .recovery_container/.recovery_box,
// .textbox(_div), .btn.blue, .fielderror, .info_head, .user_info, .Alert/.Errormsg.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'src/styles/themes.css'), 'utf8');
const ids = ['blueberry', 'blackcurrant', 'volcano', 'sunset', 'ocean', 'forest'];

function tokens(id) {
	const re = id === 'blueberry' ? /:root,\s*\[data-theme='blueberry'\]\s*\{([^}]*)\}/ : new RegExp(`\\[data-theme='${id}'\\]\\s*\\{([^}]*)\\}`);
	return Object.fromEntries([...re.exec(css)[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
}

const header = (id, file, kind) => `@import url("/__catalyst/auth/static-file?file_name=${file}");

/*
 * ${kind} - theme: ${id}. GENERATED from src/styles/themes.css by scripts/generate-login-css.js; do not edit.
 * Regenerate with \`npm run gen:login-css\` (src/tests/login.test.js fails if these drift).
 */
`;

/** Controls shared by both hosted pages. */
const controls = (t) => `
html, body {
  background: ${t.surface} !important;
  color: ${t.text} !important;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
  -webkit-font-smoothing: antialiased;
  overflow: hidden !important; /* the card is sized to this content (useIframeHeight): no inner scrollbar */
  height: auto !important; /* never stretch to fill the iframe: the card follows the content, not the reverse */
  min-height: 0 !important;
}
.textbox_div { margin-bottom: 18px !important; }
.textbox {
  background: ${t.bg} !important;
  color: ${t.text} !important;
  border: 1px solid ${t['border-strong']} !important;
  border-radius: 8px !important;
  height: 42px !important;
  text-indent: 0 !important;
  padding: 0 12px !important;
  font-size: 14px !important;
  transition: border-color .15s ease, box-shadow .15s ease !important;
}
.textbox:hover { border-color: ${t['text-muted']} !important; }
.textbox:focus {
  border-color: ${t.focus} !important;
  box-shadow: 0 0 0 1px ${t.focus} !important;
}
.textbox::placeholder { color: ${t['text-muted']} !important; opacity: 1 !important; }
.textbox:-webkit-autofill, .textbox:-webkit-autofill:hover, .textbox:-webkit-autofill:focus {
  -webkit-text-fill-color: ${t.text} !important;
  -webkit-box-shadow: 0 0 0 100px ${t.bg} inset !important;
  background-color: ${t.bg} !important;
}
.errorborder, .textbox.errorborder { border-color: ${t.danger} !important; }
.btn.blue, .blue {
  background: ${t.accent} !important;
  color: ${t['accent-contrast']} !important;
  box-shadow: none !important;
  height: 42px !important;
  border-radius: 8px !important;
  text-transform: none !important;
  letter-spacing: 0 !important;
  font-size: 14px !important;
  margin-bottom: 14px !important;
  transition: background-color .15s ease, transform .1s ease !important;
}
.btn.blue:hover, .blue:hover { background: ${t['accent-hover']} !important; box-shadow: none !important; }
.btn.blue:active { transform: translateY(1px); }
.btn:focus-visible { outline: 2px solid ${t.focus} !important; outline-offset: 2px !important; }
.loadwithbtn { border-color: ${t['accent-contrast']} !important; border-left-color: transparent !important; }
a, a:visited, .bluetext_action, .bluetext_action a, .change_user, .fielderror a { color: ${t.accent} !important; text-decoration: none !important; }
a:hover, .bluetext_action:hover { text-decoration: underline !important; }
.fielderror, .error_icon, .error_message { color: ${t.danger} !important; }
.backoption { color: ${t['text-muted']} !important; }
.backoption:hover { background: ${t['surface-2']} !important; }
`;

const signin = (t) => `
/* ---- fit the hosted form into our card (Catalyst defaults to a 520px floating card) ---- */
.signin_container {
  width: 100% !important;
  min-height: 0 !important;
  margin: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
  overflow: visible !important;
}
.signin_box {
  width: 100% !important;
  min-height: 0 !important;
  float: none !important;
  display: block !important;
  padding: 4px 2px 0 !important;
  background: transparent !important;
  border: 0 !important;
}
.signin_head, .titlename, .service_name { display: none !important; } /* our page has its own heading */
.hellouser, .backup_desc, .pass_name, .textbox_label, .textbox_actions, .oneAuthLable, .option_details { color: ${t['text-muted']} !important; }
`;

const forgot = (t) => `
/* ---- fit the hosted reset flow into our card ---- */
.bg_one { display: none !important; }
.recovery_container {
  width: 100% !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
  overflow: visible !important;
}
.recovery_box {
  width: 100% !important;
  min-height: 0 !important;
  float: none !important;
  display: block !important;
  padding: 4px 2px 0 !important;
  background: transparent !important;
  border: 0 !important;
}
.titlename, .service_logo { display: none !important; }
.fieldcontainer { margin-bottom: 18px !important; }

/* ---- theme colors ---- */
.info_head, .head_info { color: ${t.text} !important; }
.info_head { font-size: 18px !important; margin-bottom: 8px !important; }
.head_info { font-size: 14px !important; line-height: 22px !important; color: ${t['text-muted']} !important; margin: 0 0 18px !important; }
.pass_policy, .hellouser, .textbox_label, .menutext { color: ${t['text-muted']} !important; }
.user_info {
  background: ${t.bg} !important;
  border: 1px solid ${t.border} !important;
  border-radius: 8px !important;
}
.user_info .menutext { color: ${t.text} !important; }
.optionstry:hover, .optionstry { background: transparent !important; }
.optionstry:hover { background: ${t['surface-2']} !important; }
.Alert, .Errormsg {
  background: ${t['surface-2']} !important;
  color: ${t.text} !important;
  border: 1px solid ${t.border} !important;
  border-radius: 8px !important;
  box-shadow: none !important;
}
.tryanother, .extra_options { color: ${t.accent} !important; }
`;

fs.mkdirSync(path.join(ROOT, 'public/auth'), { recursive: true });
for (const id of ids) {
	const t = tokens(id);
	fs.writeFileSync(path.join(ROOT, `public/auth/login-iframe-${id}.css`), header(id, 'embedded_signin.css', 'Sign-in form') + signin(t) + controls(t));
	fs.writeFileSync(path.join(ROOT, `public/auth/forgot-iframe-${id}.css`), header(id, 'embedded_password_reset.css', 'Forgot-password flow') + forgot(t) + controls(t));
	console.log('wrote', id);
}
