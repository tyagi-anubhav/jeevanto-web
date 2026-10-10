// Decision 229 proof: /sign-in and /create-account on the non-public preview, in Chromium and WebKit.
//
//   node tools/check-sign-preview.mjs [https://jeevanto-site-preview.pages.dev]
//
// The preview sits behind Cloudflare Access. This tool passes it with the service token `jeevanto-website-checks`, read
// from the Keychain at run time and never printed. The token's two headers are added ONLY to requests for the preview's
// own host (the page and its files). Every other request goes out untouched, so Supabase, Google and Apple never see
// them, and nothing cross-origin is intercepted (a route on a cross-origin door once hid a failing preflight).
//
// What it drives: both pages render as v10's screen 09 (phone and laptop, dark and light, axe 0); two buttons,
// no Microsoft; decision 204's line on Create only; each button reaches the company's own sign-in screen through
// Supabase Auth, with Jeevanto's client and Supabase's callback, and stops there (nobody signs in); a refused sign-in
// comes back with its line and the address wiped; jeevanto.com itself still answers 404 for both.
import { chromium, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const BASE = (process.argv[2] || 'https://jeevanto-site-preview.pages.dev').replace(/\/$/, '');
const HOST = new URL(BASE).host;
const kc = a => execFileSync('security', ['find-generic-password', '-s', 'jeevanto-cloudflare', '-a', a, '-w']).toString().trim();
const ACCESS = { 'CF-Access-Client-Id': kc('access-client-id'), 'CF-Access-Client-Secret': kc('access-client-secret') };
const results = [], ok = (n, c, x = '') => { results.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`); };
const offHost = new Set();

async function ctxFor(b, opts = {}) {
  const ctx = await b.newContext(opts);
  if (opts.colorScheme) await ctx.addInitScript(t => { try { localStorage.setItem('jv-theme', t); } catch (e) {} }, opts.colorScheme);
  await ctx.route(u => u.host === HOST, route => route.continue({ headers: { ...route.request().headers(), ...ACCESS } }));
  ctx.on('request', r => { const h = new URL(r.url()).host; if (h !== HOST) offHost.add(h); });
  return ctx;
}

for (const [en, E] of [['chromium', chromium], ['webkit', webkit]]) {
  const b = await E.launch();
  // looks: both pages, phone and laptop, dark and light
  for (const [dev, vp] of [['phone', { width: 390, height: 844 }], ['laptop', { width: 1440, height: 900 }]]) for (const theme of ['dark', 'light']) {
    const ctx = await ctxFor(b, { viewport: vp, colorScheme: theme }); const p = await ctx.newPage();
    for (const [path, h1, create] of [['/sign-in', 'Welcome back.', false], ['/create-account', 'Create your account', true]]) {
      await p.goto(BASE + path, { waitUntil: 'load' });
      const t = await p.locator('h1:visible').first().innerText({ timeout: 8000 }).catch(async () => 'NO VISIBLE H1 at ' + p.url() + ' title=' + await p.title());
      const btns = await p.locator('[data-provider]').allInnerTexts();
      const consent = await p.getByText('By continuing, you agree to our').count();
      const links = await p.$$eval('a[href="/terms"], a[href="/privacy-policy"]', as => as.length);
      const robots = await p.getAttribute('meta[name=robots]', 'content');
      const font = en === 'chromium' ? await p.evaluate(() => document.fonts.check("500 14px Roboto")) : true;
      ok(`${en} ${dev} ${theme} ${path}: "${h1}", Google and Apple only, ${create ? 'decision 204’s line with both links' : 'no consent line'}, noindex`,
        t === h1 && btns.length === 2 && /Google/.test(btns[0]) && /Apple/.test(btns[1]) && !btns.join().includes('Microsoft') && (create ? consent === 1 && links >= 2 : consent === 0) && /noindex/.test(robots || '') && font,
        `h1="${t}" buttons=${JSON.stringify(btns)} consent=${consent} robots=${robots} roboto=${font}`);
      const nav = p.locator('[data-nav-sign]');
      ok(`${en} ${dev} ${theme} ${path}: signed out, the nav's top-right corner says Sign in (founder, 10 Oct 12:50)`, (await nav.isVisible()) && (await nav.innerText()) === 'Sign in' && (await nav.getAttribute('href')) === '/sign-in');
      mkdirSync('proofs/screens/sign', { recursive: true });
      await p.screenshot({ path: `proofs/screens/sign/${path.slice(1)}-${en}-${dev}-${theme}.png`, fullPage: true });
      if (en === 'chromium') {
        const axe = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        ok(`${en} ${dev} ${theme} ${path}: axe`, axe.violations.length === 0, axe.violations.map(v => v.id + ':' + v.nodes.length).join(' '));
      }
    }
    await ctx.close();
  }
  // the redirect leg: each button reaches the company's own screen, through Supabase, and stops there
  for (const [prov, host, client] of [['google', 'accounts.google.com', /23s1l9/], ['apple', 'appleid.apple.com', /^com\.jeevanto\.web$/]]) {
    const ctx = await ctxFor(b, { viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
    await p.goto(BASE + '/create-account');
    const hops = []; p.on('request', r => { if (r.isNavigationRequest()) hops.push(r.url()); });
    await p.click(`[data-provider="${prov}"]`, { noWaitAfter: true });
    await p.waitForURL(u => u.host === host || u.host.endsWith('.' + host), { timeout: 30000 }).catch(() => {});
    const at = new URL(p.url());
    const authorize = hops.find(u => u.includes('/auth/v1/authorize'));
    const rt = authorize ? new URL(authorize).searchParams.get('redirect_to') : null;
    // Google moves the OAuth parameters into its own sign-in page's query; read them from the first hop to the company
    const first = new URL(hops.find(u => new URL(u).host === host || new URL(u).host.endsWith('.' + host)) || p.url());
    const cid = first.searchParams.get('client_id') || '', ru = first.searchParams.get('redirect_uri') || '';
    if (en === 'webkit' && prov === 'apple' && !at.host.endsWith(host) && authorize) {
      // WebKit hands appleid.apple.com's sign-in to the system's own "Sign in with Apple" sheet, which a headless
      // browser can't show: the navigation simply stops. So read the same redirect the browser was given, from Node.
      const r = await fetch(authorize, { redirect: 'manual' }); const loc = new URL(r.headers.get('location') || 'about:blank');
      const c2 = loc.searchParams.get('client_id') || '', r2 = loc.searchParams.get('redirect_uri') || '';
      ok(`${en} ${prov}: the button → Supabase authorize (redirect_to this page), whose redirect is ${host} with Jeevanto's client and Supabase's callback (the hand-off to Apple's sheet can't be seen headless; named unproven)`,
        rt === BASE + '/create-account' && loc.host === host && client.test(c2) && r2 === 'https://tqaiyxijluboflyoykoi.supabase.co/auth/v1/callback',
        `authorize ${r.status} → ${loc.host}; client_id ${client.test(c2) ? 'matches' : 'MISMATCH ' + c2.slice(-12)}; redirect_uri=${r2}`);
    } else
    ok(`${en} ${prov}: the button → Supabase authorize (redirect_to this page) → ${host}, Jeevanto's client, Supabase's callback`,
      at.host.endsWith(host) && rt === BASE + '/create-account' && client.test(cid) && ru === 'https://tqaiyxijluboflyoykoi.supabase.co/auth/v1/callback',
      `at ${at.host}; redirect_to=${rt}; client_id ${client.test(cid) ? 'matches' : 'MISMATCH ' + cid.slice(-12)}; redirect_uri=${ru}`);
    await ctx.close();
  }
  // a refused sign-in: its line, and the address wiped
  {
    const ctx = await ctxFor(b, { viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
    await p.goto(BASE + '/sign-in#error=access_denied&error_description=user+cancelled');
    const msg = await p.locator('[data-err]').innerText().catch(() => '');
    ok(`${en} back from a refused sign-in: its line shown, the #fragment wiped`, msg === 'Signing in didn’t finish. You can try again.' && !p.url().includes('#'), `"${msg}" at ${p.url()}`);
    const kept = await p.evaluate(() => { try { return localStorage.getItem('jv-sign-in'); } catch (e) { return 'ERR'; } });
    ok(`${en} nothing kept in the browser when nobody signed in`, kept === null, String(kept));
    await ctx.close();
  }
  await b.close();
}
for (const path of ['/sign-in', '/create-account']) { const r = await fetch('https://jeevanto.com' + path); ok(`jeevanto.com${path} is still hidden`, r.status === 404, String(r.status)); }

mkdirSync('proofs', { recursive: true });
const out = [`decision 229 — the sign-in pages on the preview ${BASE}, ${new Date().toISOString()}`, ...results, `other hosts reached: ${[...offHost].sort().join(', ')}`];
writeFileSync('proofs/sign-preview.txt', out.join('\n') + '\n');
console.log(out.join('\n'));
console.log(`${results.filter(r => r.startsWith('PASS')).length}/${results.length} passed`);
if (results.some(r => r.startsWith('FAIL'))) process.exitCode = 1;
