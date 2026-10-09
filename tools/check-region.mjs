// Decision 246 proof: dates and numbers follow the visitor's browser region, in Chromium and WebKit.
//   node tools/check-region.mjs [base]   (default http://127.0.0.1:4321)
// For each region: the legal pages' "In force from" date and the What changed date, the grouped numbers, and the
// /check page's date-and-time (jvWhen, as the page writes a message's sent time). The words around them never change.
import { chromium, webkit } from 'playwright';
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
const CASES = [
  { locale: 'en-US', date: 'October 6, 2026', upper: 'OCTOBER 6, 2026', num: '5,000', when: /^Oct 1, 2026, 2:44 pm$/ },
  { locale: 'en-CA', date: 'October 6, 2026', upper: 'OCTOBER 6, 2026', num: '5,000', when: /^Oct 1, 2026, 2:44 pm$/ },
  { locale: 'en-IN', date: '6 October 2026', upper: '6 OCTOBER 2026', num: '5,000', when: /^1 Oct 2026, 2:44 pm$/ },
  { locale: 'en-GB', date: '6 October 2026', upper: '6 OCTOBER 2026', num: '5,000', when: /^1 Oct 2026, 14:44$/ },
  { locale: 'en', date: '6 October 2026', upper: '6 OCTOBER 2026', num: '5,000', when: /^1 Oct 2026, 2:44 pm$/ },
];
const results = [], ok = (n, c, x = '') => { results.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`); };
for (const [en, E] of [['chromium', chromium], ['webkit', webkit]]) {
  const b = await E.launch();
  for (const c of CASES) {
    const ctx = await b.newContext({ locale: c.locale, timezoneId: 'Asia/Kolkata' }); const p = await ctx.newPage();
    await p.goto(BASE + '/privacy-policy');
    const d = await p.locator('[data-jv-date]:not([data-jv-upper])').first().innerText(), u = await p.locator('[data-jv-upper]').innerText();
    await p.goto(BASE + '/terms');
    const n = await p.locator('[data-jv-num="5000"]').innerText(), words = (await p.locator('article').innerText()).includes('whichever is higher');
    await p.goto(BASE + '/check');
    const w = await p.evaluate(() => window.jvWhen('2026-10-01T09:14:03Z'));
    ok(`${en} ${c.locale}: "${d}" · "${u}" · ₹${n} · /check "${w}"`, d === c.date && u === c.upper && n === c.num && c.when.test(w) && words);
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
