// cc-website-02 JOB 3 proof: /connect/google, Google's return page, in Chromium and WebKit.
//
//   node tools/check-connect.mjs <base>     e.g. https://jeevanto.com or http://127.0.0.1:4321
//
// Made-up answers only (code=x, state=y): ENGINES' callback finds no such sign-in and sends the browser to the app's
// error link, so nothing is created anywhere. Nothing is intercepted: the browser's own request to the callback is
// read off the wire, exactly as it left.
import { chromium, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import engine from '../src/lib/engine.json' with { type: 'json' };
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
const CALLBACK = engine.url + '/functions/v1/connect-oauth/callback';
const siteHost = new URL(BASE).host, engineHost = new URL(engine.url).host;
const out = { base: BASE, when: new Date().toISOString(), results: [], offHost: [], appLinks: [], cookies: [] };
const ok = (name, cond, extra = '') => out.results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);

// Open the page with a query; return the request the browser sent to the callback (or null) and the page.
async function visit(b, query, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, ...opts }); const p = await ctx.newPage();
  let hop = null;
  ctx.on('request', r => {
    const u = new URL(r.url());
    if (u.protocol === 'jeevanto:') { out.appLinks.push(r.url()); return; }  // ENGINES' hand-back into the app: the end of the chain
    if (u.host !== siteHost && u.host !== engineHost && u.protocol !== 'data:') out.offHost.push(r.url());
    if (!hop && r.url().startsWith(CALLBACK)) hop = { url: r.url(), referer: r.headers()['referer'] || null, nav: r.isNavigationRequest() };
  });
  await p.goto(BASE + '/connect/google' + query, { waitUntil: 'commit', timeout: 10000 }).catch(() => {});  // the callback ends on jeevanto://, which a desktop browser can't open
  await p.waitForTimeout(2500);
  out.cookies.push(...(await ctx.cookies()));
  return { ctx, p, hop };
}
const sent = hop => hop && hop.url.slice(CALLBACK.length);

for (const [en, engineT] of [['chromium', chromium], ['webkit', webkit]]) {
  const b = await engineT.launch();
  let v = await visit(b, '?code=x&state=y');
  ok(`${en} ?code=x&state=y → the callback, with the same two parameters and nothing added`, sent(v.hop) === '?code=x&state=y', v.hop ? v.hop.url : 'no request to the callback');
  ok(`${en}   a navigation, with no referrer`, !!v.hop && v.hop.nav && v.hop.referer === null, v.hop ? `nav=${v.hop.nav} referer=${v.hop.referer}` : '');
  await v.ctx.close();

  v = await visit(b, '?code=4%2F0Ab_c-D&state=st%3D1&scope=email%20openid&utm_source=x&authuser=0');
  ok(`${en} Google's encoding kept byte for byte; scope, authuser and anything else dropped`, sent(v.hop) === '?code=4%2F0Ab_c-D&state=st%3D1', v.hop ? v.hop.url : 'no request');
  await v.ctx.close();

  v = await visit(b, '?error=access_denied&error_description=The%20user%20said%20no&state=y');
  ok(`${en} ?error=…&error_description=…&state=… → handed on as it came`, sent(v.hop) === '?error=access_denied&error_description=The%20user%20said%20no&state=y', v.hop ? v.hop.url : 'no request');
  await v.ctx.close();

  for (const [q, label] of [['', 'no parameters'], ['?utm_source=x&hl=en', 'only parameters it does not forward']]) {
    v = await visit(b, q);
    const h1 = await v.p.locator('h1').innerText().catch(() => '');
    const seen = await v.p.locator('[data-nothing]').isVisible().catch(() => false);
    const home = await v.p.locator('[data-nothing] a[href="/"]').count();
    ok(`${en} ${label} → "Nothing to do here.", a link home, no call to the callback`, h1 === 'Nothing to do here.' && seen && home === 1 && !v.hop && v.p.url().startsWith(BASE + '/connect/google'), `h1="${h1}" visible=${seen} hop=${!!v.hop}`);
    const meta = await v.p.evaluate(() => ({ robots: document.querySelector('meta[name=robots]')?.content, referrer: document.querySelector('meta[name=referrer]')?.content, canonical: !!document.querySelector('link[rel=canonical]') }));
    if (!q) ok(`${en}   noindex, no-referrer, no canonical`, meta.robots === 'noindex, nofollow' && meta.referrer === 'no-referrer' && !meta.canonical, JSON.stringify(meta));
    if (!q && en === 'chromium') for (const theme of ['dark', 'light']) {
      await v.p.evaluate(t => { localStorage.setItem('jv-theme', t); document.documentElement.setAttribute('data-theme', t); }, theme);
      const axe = await new AxeBuilder({ page: v.p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      ok(`${en}   accessibility (axe), ${theme}`, axe.violations.length === 0, axe.violations.map(x => x.id).join(' '));
    }
    await v.ctx.close();
  }

  v = await visit(b, '', { javaScriptEnabled: false });
  const cont = v.p.locator('noscript a, a:text-is("Continue")');
  const href = await v.p.locator('a:text-is("Continue")').getAttribute('href').catch(() => null);
  ok(`${en} without JavaScript → a plain "Continue" link to the callback`, (await cont.count()) >= 1 && href === CALLBACK, `href=${href}`);
  await v.ctx.close();
  await b.close();
}

const sitemap = await (await fetch(BASE + '/sitemap.txt')).text();
const menu = await (await fetch(BASE + '/')).text();
ok('not in the sitemap or the front door\'s menu and footer', !sitemap.includes('/connect') && !menu.includes('/connect/google'));

mkdirSync('proofs', { recursive: true });
writeFileSync(`proofs/connect-google-${siteHost.replace(/[:.]/g, '_')}.json`, JSON.stringify(out, null, 1));
console.log(out.results.join('\n'));
console.log('handed back to the app:', out.appLinks.length, [...new Set(out.appLinks)].join(' '));
console.log('requests to any other host:', out.offHost.length, out.offHost.slice(0, 5).join(' '));
console.log('cookies:', out.cookies.length);
if (out.results.some(r => r.startsWith('FAIL')) || out.offHost.length || out.cookies.length) process.exitCode = 1;
