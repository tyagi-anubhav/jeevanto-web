// Decision 246 proof: dates and numbers follow the visitor's browser region, in Chromium and WebKit.
//   node tools/check-region.mjs [base]   (default http://127.0.0.1:4321)
// For each region: the legal pages' "In force from" date and the What changed date, the grouped numbers, and the
// /check page's date-and-time (jvWhen, as the page writes a message's sent time). The words around them never change.
import { chromium, webkit } from 'playwright';
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
// The legal date is whatever the page marks (data-jv-date, the console's in_force_date), so a new policy version
// never makes this check stale (it hard-coded 6 October until 12 Oct, and failed on 1.2's 9 October).
// 'month' = month first (October 9, 2026); 'day' = day first (9 October 2026).
const CASES = [
  { locale: 'en-US', order: 'month', num: '5,000', when: /^Oct 1, 2026, 2:44 pm$/ },
  { locale: 'en-CA', order: 'month', num: '5,000', when: /^Oct 1, 2026, 2:44 pm$/ },
  { locale: 'en-IN', order: 'day', num: '5,000', when: /^1 Oct 2026, 2:44 pm$/ },
  { locale: 'en-GB', order: 'day', num: '5,000', when: /^1 Oct 2026, 14:44$/ },
  { locale: 'en', order: 'day', num: '5,000', when: /^1 Oct 2026, 2:44 pm$/ },
];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const spoken = (iso, order) => { const [y, m, d] = iso.split('-').map(Number); return order === 'month' ? `${MONTHS[m - 1]} ${d}, ${y}` : `${d} ${MONTHS[m - 1]} ${y}`; };
const results = [], ok = (n, c, x = '') => { results.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`); };
for (const [en, E] of [['chromium', chromium], ['webkit', webkit]]) {
  const b = await E.launch();
  for (const c of CASES) {
    const ctx = await b.newContext({ locale: c.locale, timezoneId: 'Asia/Kolkata' }); const p = await ctx.newPage();
    await p.goto(BASE + '/privacy-policy');
    const d = await p.locator('[data-jv-date]:not([data-jv-upper])').first().innerText(), u = await p.locator('[data-jv-upper]').innerText();
    const iso = await p.locator('[data-jv-date]:not([data-jv-upper])').first().getAttribute('data-jv-date');
    await p.goto(BASE + '/terms');
    const n = await p.locator('[data-jv-num="5000"]').innerText(), words = (await p.locator('article').innerText()).includes('whichever is higher');
    await p.goto(BASE + '/check');
    const w = await p.evaluate(() => window.jvWhen('2026-10-01T09:14:03Z'));
    // a bare "en" is whatever the browser reports: Chromium keeps "en" (no region, the built default stands); WebKit
    // reports "en-US", and the page follows it, as it should. The expectation follows the reported region.
    const reported = await p.evaluate(() => window.jvRegion.region);
    const want = c.locale === 'en' && reported === 'US' ? CASES[0] : c;
    const date = spoken(iso, want.order);
    ok(`${en} ${c.locale}${c.locale === 'en' ? ' (reported: ' + (reported || 'no region') + ')' : ''}: "${d}" · "${u}" · ₹${n} · /check "${w}"`, d === date && u === date.toUpperCase() && n === want.num && want.when.test(w) && words, d === date ? '' : 'want "' + date + '"');
    await ctx.close();
  }
  // a large number groups by region: lakh in India, thousands elsewhere
  for (const [loc, want] of [['en-IN', '1,72,000'], ['en-US', '172,000'], ['en-GB', '172,000']]) {
    const ctx = await b.newContext({ locale: loc }); const p = await ctx.newPage(); await p.goto(BASE + '/terms');
    const got = await p.evaluate(() => window.jvRegion.num(172000));
    ok(`${en} ${loc}: 172000 → "${got}"`, got === want); await ctx.close();
  }
  await b.close();
}
console.log(results.join('\n')); console.log(`${results.filter(r => r.startsWith('PASS')).length}/${results.length} passed`);
if (results.some(r => r.startsWith('FAIL'))) process.exitCode = 1;
