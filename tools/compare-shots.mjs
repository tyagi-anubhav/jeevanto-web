// Proof 4: every page, phone and laptop, dark and light, screenshotted on the site and in Claude Design's
// prototype (coming-soon mode), and set side by side (site left, design right).
// Usage: node tools/compare-shots.mjs <site base url> [page ...]   (design served on :8731, see design-probe.mjs)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openDesign, go } from './design-probe.mjs';
const SITE = process.argv[2] || 'http://127.0.0.1:4321';
const PAGES = [
  ['home', '/', 'home'], ['does', '/what-it-does', 'does'], ['circle', '/circle', 'circle'], ['kin', '/kin-mode', 'kin'],
  ['promise', '/our-promise', 'privacy'], ['help', '/help', 'help'], ['privacy-policy', '/privacy-policy', 'paper', { doc: 'policy' }],
  ['terms', '/terms', 'paper', { doc: 'terms' }], ['refunds', '/refunds', 'paper', { doc: 'refunds' }],
  ['check', '/check', 'letter', { chk: '', chkVal: '' }], ['invited', '/invited', 'invite'], ['recover', '/recover', 'rc', { rc: 'front' }], ['404', '/no-such-page', null],
].filter(p => process.argv.length <= 3 || process.argv.slice(3).includes(p[0]));
const DEV = { laptop: { w: 1440, h: 900 }, phone: { w: 390, h: 844 } };
const OUT = process.env.OUT || 'proofs/screens';
mkdirSync(OUT, { recursive: true });
const FF = process.env.FFMPEG;
const b = await chromium.launch();
for (const [dev, vp] of Object.entries(DEV)) for (const theme of ['dark', 'light']) {
  const sctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: 'reduce' });
  const sp = await sctx.newPage();
  const { ctx: dctx, page: dp } = await openDesign(b, { w: vp.w, h: vp.h, theme, scheme: theme, dsf: 1 });
  for (const [key, path, nav, extra] of PAGES) {
    await sp.goto(SITE + path, { waitUntil: 'networkidle' }); await sp.evaluate(() => document.fonts.ready); await sp.waitForTimeout(300);
    const siteFile = `${OUT}/${key}-${dev}-${theme}-site.png`;
    await sp.screenshot({ path: siteFile, fullPage: true });
    if (!nav) { console.log(key, dev, theme, 'site only'); continue; }
    await go(dp, nav, extra); await dp.evaluate(() => window.scrollTo(0, 0));
    const designFile = `${OUT}/${key}-${dev}-${theme}-design.png`;
    await dp.screenshot({ path: designFile, fullPage: true });
    console.log(key, dev, theme);
  }
  await sctx.close(); await dctx.close();
}
await b.close();
