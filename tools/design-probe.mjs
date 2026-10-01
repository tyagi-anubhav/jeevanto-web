// Drives Claude Design's prototype (Site v10) locally, for extraction and side-by-side proofs.
import { chromium } from 'playwright';
// The design reference: v10 since 1 Oct (addendum 1); v9 is in ClaudeDesign's _superseded/.
export const DESIGN = 'http://127.0.0.1:8731/' + encodeURIComponent(process.env.DESIGN_FILE || 'Site v10.dc.html');
export async function openDesign(browser, { w, h, theme, scheme, dsf = 2 }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, colorScheme: scheme || theme, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.addInitScript((t) => { try { localStorage.setItem('jv-site-v9', JSON.stringify({ page: 'home', theme: t, cap: true })); } catch (e) {} }, theme);
  await page.goto(DESIGN, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__jvSite && window.__dcRootName && window.__dcRootName());
  await page.evaluate(() => window.__dcSetProps(window.__dcRootName(), { siteMode: 'coming soon' }));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  return { ctx, page };
}
export async function go(page, nav, extra) {
  await page.evaluate(([n, e]) => { window.__jvSite.nav(n, e || {}); window.__jvSite.setState({ cap: true }); }, [nav, extra]);
  await page.waitForTimeout(700);
}
if (process.argv[2] === 'probe') {
  const b = await chromium.launch();
  const { page } = await openDesign(b, { w: 1440, h: 900, theme: 'dark' });
  const out = await page.evaluate(() => {
    const wm = document.querySelector('.iw'); const orb = document.querySelector('[data-screen-label="01 Front door"] .orb-root');
    return { wm: wm && wm.outerHTML.length, orb: orb && orb.outerHTML.length, orbHtml: orb && orb.outerHTML.slice(0, 1500), wmHtml: wm && wm.outerHTML.slice(0, 1200) };
  });
  console.log(JSON.stringify(out, null, 1));
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-girishmathur-Anubhav-Developer-Projects-Jeevanto-app/b143ebd3-a45b-411a-b76a-a05205ca3a40/scratchpad/probe.png' });
  await b.close();
}
