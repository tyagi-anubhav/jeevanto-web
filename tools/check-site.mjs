// Proofs 2, 3 and 6 against a running copy of the site (local or https://jeevanto.com):
//  2. every link works: each internal address answers 200, each #anchor exists on its page, outside links answer;
//  3. nothing goes to another host: every request each page makes (films played, menus opened) is recorded,
//     and no cookie is set;
//  6. accessibility: axe-core (WCAG 2.2 A/AA) on every page, laptop and phone, dark and light.
// Usage: node tools/check-site.mjs <base url>   → proofs/site-check-<host>.json and a printed summary.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
const host = new URL(BASE).host;
const FIXED = ['/', '/what-it-does', '/circle', '/kin-mode', '/our-promise', '/help', '/privacy-policy', '/terms', '/refunds', '/check', '/recover', '/invited'];
const out = { base: BASE, when: new Date().toISOString(), pages: {}, links: {}, offHost: [], cookies: [], axe: [], consoleErrors: [] };
const b = await chromium.launch();
const seen = new Set(FIXED), queue = [...FIXED], anchors = {}, linkTargets = new Map();

for (const [dev, vp] of Object.entries({ laptop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } })) for (const theme of ['dark', 'light']) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: theme, isMobile: dev === 'phone', hasTouch: dev === 'phone' });
  await ctx.addInitScript(t => { try { localStorage.setItem('jv-theme', t); } catch (e) {} }, theme);
  const page = await ctx.newPage();
  page.on('request', r => { const u = new URL(r.url()); if (!['data:', 'blob:'].includes(u.protocol) && u.host !== host) out.offHost.push({ page: page.url(), url: r.url() }); });
  page.on('console', m => { if (m.type() === 'error') out.consoleErrors.push({ page: page.url(), dev, theme, text: m.text() }); });
  const list = dev === 'laptop' && theme === 'dark' ? queue : FIXED;
  for (let i = 0; i < list.length; i++) {
    const path = list[i];
    const resp = await page.goto(BASE + path, { waitUntil: 'networkidle' });
    if (dev === 'laptop' && theme === 'dark') {
      out.pages[path] = { status: resp.status(), finalUrl: page.url(), title: await page.title() };
      anchors[path] = await page.evaluate(() => [...document.querySelectorAll('[id]')].map(e => e.id));
      const hrefs = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')));
      for (const h of hrefs) {
        if (h.startsWith('mailto:')) { linkTargets.set(h, 'mailto'); continue; }
        const u = new URL(h, BASE + path);
        if (u.host === host) { const p = u.pathname; if (!seen.has(p)) { seen.add(p); queue.push(p); } linkTargets.set(path + ' → ' + h, { path: p, hash: u.hash.slice(1) }); }
        else linkTargets.set(h, 'external');
      }
    }
    // play every film on the page, open every closed part, so their requests are recorded too
    await page.evaluate(async () => { for (const v of document.querySelectorAll('video')) { if (v.offsetParent) { v.scrollIntoView(); await new Promise(r => setTimeout(r, 150)); try { await v.play(); } catch (e) {} } } });
    for (const sel of ['[data-sec-more]', '[data-faq][aria-expanded="false"]']) for (const el of await page.locator(sel).all()) { if (await el.isVisible()) await el.click().catch(() => {}); }
    if (dev === 'phone') { const m = page.locator('[data-menu-toggle]'); if (await m.isVisible()) await m.click(); }
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, 0));
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    for (const v of axe.violations) out.axe.push({ page: path, dev, theme, id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map(n => n.target.join(' ')) });
  }
  out.cookies.push(...(await ctx.cookies()).map(c => ({ dev, theme, name: c.name, domain: c.domain })));
  await ctx.close();
}
// Links
for (const [k, t] of linkTargets) {
  if (t === 'mailto') { out.links[k] = 'mailto (not fetched)'; continue; }
  if (t === 'external') { try { const r = await fetch(k, { redirect: 'follow', signal: AbortSignal.timeout(15000) }); out.links[k] = r.status; } catch (e) { out.links[k] = 'ERROR ' + e.message; } continue; }
  const r = await fetch(BASE + t.path, { redirect: 'manual' });
  let ok = r.status === 200;
  if (ok && t.hash) { if (!anchors[t.path]) { const pg = await b.newPage(); await pg.goto(BASE + t.path); anchors[t.path] = await pg.evaluate(() => [...document.querySelectorAll('[id]')].map(e => e.id)); await pg.close(); } ok = anchors[t.path].includes(t.hash); }
  out.links[k] = ok ? 'OK ' + r.status : 'BROKEN ' + r.status + (t.hash ? ' #' + t.hash : '');
}
// The 404 page, and that an unknown address really answers 404
const nf = await fetch(BASE + '/no-such-page'); out.notFound = nf.status;
await b.close();
mkdirSync('proofs', { recursive: true });
const file = `proofs/site-check-${host.replace(/[:.]/g, '_')}.json`; writeFileSync(file, JSON.stringify(out, null, 1));
const broken = Object.entries(out.links).filter(([, v]) => !/^OK|mailto|^200$/.test(String(v)));
const axeSerious = out.axe.filter(v => ['serious', 'critical'].includes(v.impact));
console.log(`pages crawled: ${Object.keys(out.pages).length} (${Object.entries(out.pages).filter(([, p]) => p.status !== 200).map(([k, p]) => k + '=' + p.status).join(', ') || 'all 200'})`);
console.log(`links checked: ${Object.keys(out.links).length}, broken: ${broken.length}`); broken.forEach(x => console.log('  BROKEN', x.join(' ')));
console.log(`requests to other hosts: ${out.offHost.length}`); out.offHost.slice(0, 10).forEach(x => console.log('  ', x.url));
console.log(`cookies set: ${out.cookies.length}`);
console.log(`console errors: ${out.consoleErrors.length}`); [...new Set(out.consoleErrors.map(e => e.text))].slice(0, 8).forEach(t => console.log('  ', t.slice(0, 200)));
console.log(`unknown address → ${out.notFound}`);
console.log(`axe violations: ${out.axe.length} (serious/critical: ${axeSerious.length})`);
const byId = {}; out.axe.forEach(v => { const k = v.id + ' [' + v.impact + ']'; byId[k] = byId[k] || []; byId[k].push(v.page + ' ' + v.dev + '/' + v.theme + ' ' + v.sample.join(' | ')); });
Object.entries(byId).forEach(([k, v]) => { console.log('  ' + k + ' ×' + v.length); v.slice(0, 4).forEach(s => console.log('     ' + s.slice(0, 220))); });
console.log('written', file);
