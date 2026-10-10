// Decision 229 proof, part 2: what the site does AFTER Google or Apple hand a person back, driven for real on the
// non-public preview, on a TEST identity (ENGINES' fixtures; the test domain only), in Chromium.
//
//   APP=<a checkout of the app repo's master> JEEVANTO_REPO=<the main app checkout, for .env.staging> \
//   W11C_SCRATCH=<file outside both repos> node tools/check-sign-session.mjs [https://jeevanto-site-preview.pages.dev]
//   … then the same W11C_SCRATCH with `node scripts/verify/wave25/website-fixtures.mjs teardown` from APP.
//
// A provider's sign-in can't be driven here (no real Google or Apple account is ours to use), so the test account's
// own session is handed to the page exactly as Supabase hands one back after Google or Apple: in the address's
// #fragment (access_token, refresh_token, token_type, expires_in). Everything after that is the real page against the
// live engine: the account door's preflight, the read-back, the agreement door, the one sign-in record, Sign out.
// Nothing cross-origin is intercepted; the Access headers go only to the preview's own host.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const BASE = (process.argv[2] || 'https://jeevanto-site-preview.pages.dev').replace(/\/$/, ''), HOST = new URL(BASE).host;
const { APP } = process.env; if (!APP || !process.env.W11C_SCRATCH) { console.error('APP=… W11C_SCRATCH=… node tools/check-sign-session.mjs'); process.exit(2); }
const lib = await import(APP + '/scripts/verify/wave11c/lib.mjs');
const kc = a => execFileSync('security', ['find-generic-password', '-s', 'jeevanto-cloudflare', '-a', a, '-w']).toString().trim();
const ACCESS = { 'CF-Access-Client-Id': kc('access-client-id'), 'CF-Access-Client-Secret': kc('access-client-secret') };
const results = [], ok = (n, c, x = '') => { results.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`); return c; };
const mask = s => String(s).replace(/[^\s@"]+@jeevanto-test\.local/g, '‹test address›');

// 1 · a test account, and its session (one sign-in by password, as a provider's return would carry)
// no name from the provider (as Apple's web flow gave the founder, 9 Oct): the page must ask, never show an address
const acct = await lib.createTestAccount('w229web', '');
const tok = await (await fetch(`${lib.BASE}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: lib.ENV.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: acct.email, password: acct.password }) })).json();
ok('a test account (the test domain) and its session', !!tok.access_token && !!acct.accountId, `account ${acct.accountId ? 'provisioned' : 'NOT provisioned'}`);

// 2 · the account door's preflight from the preview, as the browser sends it
const pf = await fetch(`${lib.BASE}/functions/v1/account`, { method: 'OPTIONS', headers: { Origin: BASE, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'apikey, authorization, content-type' } });
ok('the account door answers the preview\'s preflight', pf.status === 204 && pf.headers.get('access-control-allow-origin') === BASE, `${pf.status} ${pf.headers.get('access-control-allow-origin')}`);

const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route(u => u.host === HOST, route => route.continue({ headers: { ...route.request().headers(), ...ACCESS } }));
const failed = []; ctx.on('requestfailed', r => failed.push(r.method() + ' ' + new URL(r.url()).pathname + ' ' + (r.failure() || {}).errorText));
const doors = []; ctx.on('response', r => { const u = new URL(r.url()); if (u.host !== HOST && /\/(account|auth\/v1\/user|auth\/v1\/logout)/.test(u.pathname)) doors.push(`${r.request().method()} ${u.pathname} ${r.status()}`); });
const p = await ctx.newPage();
const shown = (s, t = 20000) => p.waitForSelector(`[data-state="${s}"]:not([hidden])`, { timeout: t }).then(() => true, () => false);
const kept = () => p.evaluate(() => { try { return localStorage.getItem('jv-sign-in'); } catch (e) { return 'ERR'; } });

// 3 · back from the provider: a new account → who you are
await p.goto(`${BASE}/create-account#access_token=${tok.access_token}&refresh_token=${tok.refresh_token}&token_type=bearer&expires_in=${tok.expires_in}`);
const askedName = await shown('name');
const nameStepH1 = askedName ? await p.locator('[data-state="name"] h1').innerText() : '';
const leaked = await p.evaluate(() => /@/.test(document.querySelector('main').innerText.split('YOUR ACCOUNT')[1] || '') && !document.querySelector('[data-state="review"]:not([hidden])'));
ok('no name from the provider → "Good, that’s you. Now your name.", and no address shown as a name', askedName && nameStepH1 === 'Good, that’s you. Now your name.' && !leaked, `h1="${nameStepH1}"`);
ok('the name step says which account is signed in ("Signed in as …")', /^Signed in as \S+@\S+\.$/.test(await p.locator('[data-who]').innerText()));
// decision 254 (TESTS' case): a two-word first name and a 40-character last name
const LAST = 'Loooooooooooooooooooooooooooooooooongname';
await p.fill('#sg-first', 'Sai Krishna'); await p.fill('#sg-last', LAST); await p.click('[data-name-go]');
const rev = await shown('review');
const rows = rev ? await p.$$eval('[data-rows] > div', ds => ds.map(d => d.innerText.replace(/\s+/g, ' ').trim())) : [];
const stored = await lib.sql(`select display_name from sentinel_policy.actor_registry where user_id = (select user_id from sentinel_identity.users where account_id = '${acct.accountId}'::uuid limit 1) and actor_type = 'USER'`);
ok('the typed name is stored on the account (never an address)', stored[0] && stored[0].display_name === 'Sai Krishna ' + LAST, JSON.stringify(stored));
ok('then "This is who you are, as we have it." with the typed name, and the email marked verified', rev && rows[0] === 'Name Sai Krishna ' + LAST && /^Email .*@jeevanto-test\.local verified$/.test(rows[1] || ''), mask(JSON.stringify(rows)) + (rev ? '' : ' err=' + await p.locator('[data-err]').innerText().catch(() => '')));
ok('the tokens are wiped from the address', !p.url().includes('#') && !p.url().includes('access_token'), p.url());
ok('one sign-in record kept in the browser', !!(await kept()), (await kept()) ? 'jv-sign-in present' : 'none');
const agreed = await lib.sql(`select document, version, way_in from sentinel_identity.legal_agreements where account_id = '${acct.accountId}'::uuid order by document`);
// The account's creation records the agreement first, with way_in = the sign-in provider (email, google, apple, mobile;
// ENGINES' _record_legal_agreement, decision 204); the site's door then adds nothing for the same version, so
// 'website' appears only when no earlier record exists (ENGINES, 7 Oct 00:2x).
const pageVersion = await p.evaluate(() => document.querySelector("[data-sign]").getAttribute("data-legal-version"));
ok(`the agreement is recorded: Terms and Privacy at the version the page showed (${pageVersion}), by the sign-in or the site`, !!pageVersion && agreed.length === 2 && agreed.every(a => a.version === pageVersion && ['email', 'google', 'apple', 'mobile', 'website'].includes(a.way_in)), JSON.stringify(agreed));

// 4 · that's right → account made → or continue here → signed in
await p.click('[data-right]');
const made = await shown('created');
const gift = made ? await p.locator('[data-state="created"]').innerText() : '';
ok('"That’s right" → "Now, get the app…" with the welcome gift and both store badges', made && /3 months of Plus, free, waiting for you in the app\. They start the day you first open it\./.test(gift) && (await p.locator('[data-state="created"] img[alt^="Download on the App Store"], [data-state="created"] img[alt^="Get it on Google Play"]').count()) === 2, gift.replace(/\s+/g, ' ').slice(0, 120));
const lefts = await p.evaluate(() => { const s = document.querySelector('[data-state="created"]'), x = e => Math.round(e.getBoundingClientRect().left); return [x(s.querySelector('h1')), x(s.querySelector('[data-here]'))]; });
ok('"Or continue here" is left-aligned with the heading (Cowork, 10 Oct)', lefts[0] === lefts[1], lefts.join(' vs '));
await p.click('[data-here]');
ok('"Or continue here" → "You’re signed in as Sai Krishna." (the whole first name, decision 254)', await shown('in') && (await p.locator('[data-signed-in]').innerText()) === 'You’re signed in as Sai Krishna.');
await p.setViewportSize({ width: 390, height: 844 });
ok('a long name never pushes the page sideways on a phone (390 wide)', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
await p.screenshot({ path: 'proofs/screens/sign/signed-in-phone.png', fullPage: true }).catch(() => {});
ok('signed in: one Sign out, in the nav’s top-right corner, and none on the page (founder, 10 Oct 12:50)', (await p.locator('[data-nav-sign]').innerText()) === 'Sign out' && (await p.locator('main button:has-text("Sign out")').count()) === 0);
await p.goto(`${BASE}/our-promise`);
ok('every page: the nav says Sign out while signed in', (await p.locator('[data-nav-sign]').innerText()) === 'Sign out');
const meta = await fetch(`${lib.BASE}/auth/v1/user`, { headers: { apikey: lib.ENV.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + JSON.parse(await kept()).access } }).then(r => r.json());
ok('the first name is saved exactly as typed, beside the full name (decision 254)', meta.user_metadata && meta.user_metadata.first_name === 'Sai Krishna' && meta.user_metadata.display_name === 'Sai Krishna ' + LAST, JSON.stringify({ first: meta.user_metadata && meta.user_metadata.first_name }));

// 5 · come back later: the one record is still good
await p.goto(`${BASE}/sign-in`);
ok('a return visit is still signed in (the record checked against the engine)', await shown('in') && (await p.locator('[data-signed-in]').innerText()) === 'You’re signed in as Sai Krishna.');
const again = await lib.sql(`select count(*)::int n from sentinel_identity.legal_agreements where account_id = '${acct.accountId}'::uuid`);
ok('a return visit records no second agreement', again[0].n === 2, String(again[0].n));

// 6 · sign out clears it
await p.click('[data-nav-sign]');
await p.waitForURL(u => u.pathname === '/sign-in', { timeout: 10000 }).catch(() => {});
ok('Sign out → "Welcome back." (the Sign in page), and the record is gone from the browser', p.url().endsWith('/sign-in') && await shown('ask') && (await p.locator('[data-state="ask"] h1').innerText()) === 'Welcome back.' && (await kept()) === null && (await p.locator('[data-nav-sign]').innerText()) === 'Sign in', p.url());
await p.goto(`${BASE}/sign-in`);
ok('after signing out, a return visit is signed out', await shown('ask', 5000) && !(await p.locator('[data-state="in"]').isVisible()));
const still = await fetch(`${lib.BASE}/auth/v1/user`, { headers: { apikey: lib.ENV.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + tok.access_token } });
ok('the signed-out session is refused by the engine afterwards', still.status === 401 || still.status === 403, String(still.status));
ok('no request failed (CORS or otherwise)', failed.length === 0, failed.join(' | '));
await b.close();

const out = [`decision 229 — after the sign-in, on the preview ${BASE}, ${new Date().toISOString()} (a test identity; teardown follows)`, ...results.map(mask), `the engine's answers seen: ${doors.join(', ')}`];
writeFileSync('proofs/sign-session.txt', out.join('\n') + '\n');
console.log(out.join('\n')); console.log(`${results.filter(r => r.startsWith('PASS')).length}/${results.length} passed`);
if (results.some(r => r.startsWith('FAIL'))) process.exitCode = 1;
