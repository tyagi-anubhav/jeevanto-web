// Proof 5: each page's words on the site against Claude Design's prototype (coming-soon mode), laptop, dark.
// Every closed part (Circle sections, Help answers) is opened on both sides first. Writes proofs/text/<page>.diff.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openDesign, go } from './design-probe.mjs';
const SITE = process.argv[2] || 'http://127.0.0.1:4321';
const PAGES = [['home', '/', 'home'], ['does', '/what-it-does', 'does'], ['circle', '/circle', 'circle'], ['kin', '/kin-mode', 'kin'], ['promise', '/our-promise', 'privacy'], ['help', '/help', 'help'],
  ['privacy-policy', '/privacy-policy', 'paper', { doc: 'policy' }], ['terms', '/terms', 'paper', { doc: 'terms' }], ['refunds', '/refunds', 'paper', { doc: 'refunds' }]];
const OUT = 'proofs/text'; mkdirSync(OUT, { recursive: true });
const clean = t => t.split('\n').map(s => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n') + '\n';
const b = await chromium.launch();
const sctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce' }); const sp = await sctx.newPage();
const { page: dp } = await openDesign(b, { w: 1440, h: 900, theme: 'dark', dsf: 1 });
const summary = [];
for (const [key, path, nav, extra] of PAGES) {
  await sp.goto(SITE + path, { waitUntil: 'networkidle' });
  let site;
  if (key === 'help') {
    const n = await sp.locator('[data-faq]').count(); const parts = [];
    for (let i = 0; i < n; i++) { const btn = sp.locator('[data-faq]').nth(i); if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click(); parts.push(await sp.locator('main').innerText()); }
    site = parts.join('\n');
  } else {
    if (key === 'circle') for (const btn of await sp.locator('[data-sec-more]').all()) await btn.click();
    site = await sp.locator('main').innerText();
  }
  await go(dp, nav, extra);
  let design;
  const mainText = () => dp.evaluate(() => { const r = document.querySelector('[data-jv-root]'); const kids = [...r.children].slice(1).filter(k => !(k.getAttribute('style') || '').includes('footTop') && !k.querySelector('[style*="footTop"]') && getComputedStyle(k).position !== 'fixed'); return kids.map(k => k.innerText).join('\n'); });
  if (key === 'help') { const parts = []; const n = await dp.evaluate(() => window.__jvSite.renderVals().faqs.length);
    for (let i = 0; i < n; i++) { await dp.evaluate(i => window.__jvSite.setState({ faq: i }), i); await dp.waitForTimeout(200); parts.push(await mainText()); } design = parts.join('\n'); }
  else { if (key === 'circle') { await dp.evaluate(() => window.__jvSite.setState({ open: { family: 1, sharing: 1, logins: 1, kin: 1, limits: 1, change: 1, join: 1 } })); await dp.waitForTimeout(400); } design = await mainText(); }
  writeFileSync(`${OUT}/${key}.site.txt`, clean(site)); writeFileSync(`${OUT}/${key}.design.txt`, clean(design));
  let diff = ''; try { execFileSync('diff', ['-u', `${OUT}/${key}.design.txt`, `${OUT}/${key}.site.txt`]); } catch (e) { diff = String(e.stdout); }
  writeFileSync(`${OUT}/${key}.diff`, diff);
  const changed = diff.split('\n').filter(l => /^[-+][^-+]/.test(l)).length; summary.push(`${key}: ${changed} changed lines`); console.log(key, changed);
}
writeFileSync(`${OUT}/SUMMARY.txt`, summary.join('\n') + '\n');
await b.close();
