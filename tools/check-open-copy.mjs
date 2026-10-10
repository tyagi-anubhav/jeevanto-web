// Decision 258: /open-your-copy opens ENGINES' test vector (tools/fixtures/copy-vector.*, made with no account) in a
// real browser, and sends nothing anywhere. Usage: node tools/check-open-copy.mjs <base>   (Chromium and WebKit)
import { chromium, webkit } from 'playwright';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
const V = JSON.parse(readFileSync(new URL('./fixtures/copy-vector.json', import.meta.url), 'utf8'));
const FILE = new URL('./fixtures/copy-vector.jvcopy', import.meta.url).pathname;
const results = [], ok = (n, c, x = '') => results.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
for (const [en, E] of [['chromium', chromium], ['webkit', webkit]]) {
  const b = await E.launch(); const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
  const sent = []; p.on('request', r => { if (!r.url().startsWith(BASE) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) sent.push(r.url()); });
  await p.goto(BASE + '/open-your-copy', { waitUntil: 'load' });
  const before = []; p.on('request', r => before.push(r.method() + ' ' + r.url()));
  const tryCode = async (code, file = FILE) => {
    await p.setInputFiles('#oc-file', file); await p.fill('#oc-code', code); await p.click('[data-go]');
    await p.waitForFunction(() => !document.querySelector('[data-state="busy"]').hidden === false && (!document.querySelector('[data-state="open"]').hidden || !document.querySelector('[data-err]').hidden), null, { timeout: 30000 });
  };
  for (const [label, code] of [['the code as emailed', V.code], ['lower case with spaces', V.code.toLowerCase().replace(/-/g, ' ')]]) {
    await p.goto(BASE + '/open-your-copy', { waitUntil: 'load' }); before.length = 0;
    await tryCode(code);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-save]')]);
    const got = readFileSync(await dl.path());
    ok(`${en} ${label}: "Your copy is open.", and the saved file is the unlocked copy (${V.unlocked_bytes} bytes, sha256 matches)`,
      (await p.locator('[data-state="open"] h1').innerText()) === 'Your copy is open.' && got.length === V.unlocked_bytes && createHash('sha256').update(got).digest('hex') === V.unlocked_sha256, `${got.length} bytes`);
    ok(`${en} ${label}: opening made no request at all (nothing uploaded)`, before.filter(r => !r.includes('blob:')).length === 0, before.join(' | '));
  }
  await p.goto(BASE + '/open-your-copy', { waitUntil: 'load' });
  await tryCode('AAAA-BBBB-CCCC-DDDD');
  ok(`${en} a wrong code: "That code doesn’t open this copy."`, (await p.locator('[data-err]').innerText()) === 'That code doesn’t open this copy.');
  await p.goto(BASE + '/open-your-copy', { waitUntil: 'load' });
  await tryCode(V.code, new URL('./fixtures/copy-vector.json', import.meta.url).pathname);
  ok(`${en} a file that isn't a copy: "This isn’t a Jeevanto copy."`, (await p.locator('[data-err]').innerText()) === 'This isn’t a Jeevanto copy.');
  ok(`${en} nothing went to another address`, sent.length === 0, sent.join(' | '));
  await b.close();
}
console.log(results.join('\n')); const f = results.filter(r => r.startsWith('FAIL')).length;
console.log(`${results.length - f}/${results.length} passed`); if (f) process.exitCode = 1;
