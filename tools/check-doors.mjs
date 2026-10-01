// JOB 2 proofs for /check, /invited, /recover and /recover/answer.
//
//   node tools/check-doors.mjs live <base>   LIVE drives on ENGINES' real doors, using only inputs that can't reach a
//                                            real person: a made-up reference, a made-up invite code, an address at
//                                            example.com (RFC 2606, undeliverable) and a made-up ask link. Records every
//                                            request (only the site and the engine may be reached) and every cookie.
//   node tools/check-doors.mjs mock <base>   Every page STATE, with the engine's answers canned from its note
//                                            (cc-wave-23-to-website-the-doors §2–5). Renders, screenshots (phone and
//                                            laptop, dark and light) and runs axe on each. This proves the page, NOT the
//                                            door: the paths that need a real contact stay unproven until ENGINES lists
//                                            test identities and drives.
//
// Locally the engine only answers jeevanto.com's origin (CORS), so off jeevanto.com the browser's calls are passed
// through Node unchanged; on https://jeevanto.com they go straight from the browser.
import { chromium, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import engine from '../src/lib/engine.json' with { type: 'json' };
const [mode = 'live', BASE0 = 'http://127.0.0.1:4321'] = process.argv.slice(2);
const BASE = BASE0.replace(/\/$/, ''), onLive = /^https:\/\/jeevanto\.com$/.test(BASE);
const siteHost = new URL(BASE).host, engineHost = new URL(engine.url).host;
const out = { mode, base: BASE, when: new Date().toISOString(), results: [], requests: {}, offHost: [], cookies: [], axe: [] };
const ok = (name, cond, extra = '') => { out.results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };

async function context(b, opts, mocks) {
  const ctx = await b.newContext(opts);
  if (opts.colorScheme) await ctx.addInitScript(t => { try { localStorage.setItem('jv-theme', t); } catch (e) {} }, opts.colorScheme);
  ctx.on('request', r => { const h = new URL(r.url()).host; out.requests[h] = (out.requests[h] || 0) + 1; if (h !== siteHost && h !== engineHost && !r.url().startsWith('data:')) out.offHost.push(r.url()); });
  // On jeevanto.com the browser's calls go out untouched: intercepting them would skip the CORS preflight, and a
  // proof that passes because of the harness is no proof (it did, once, in Chromium).
  if (onLive && !mocks) return ctx;
  await ctx.route(engine.url + '/**', async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return onLive ? route.continue() : route.fulfill({ status: 204, headers: cors() });
    if (mocks) { const body = JSON.parse(req.postData() || '{}'); const [status, json] = mocks(body); return route.fulfill({ status, headers: { ...cors(), 'content-type': 'application/json' }, body: JSON.stringify(json) }); }
    if (onLive) return route.continue();
    const r = await fetch(req.url(), { method: req.method(), headers: req.headers(), body: req.postData() });
    return route.fulfill({ status: r.status, headers: { ...cors(), 'content-type': 'application/json' }, body: await r.text() });
  });
  return ctx;
}
const cors = () => ({ 'access-control-allow-origin': '*', 'access-control-allow-headers': 'apikey, authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS' });
const txt = (p, sel) => p.locator(sel).innerText();
const visible = (p, sel) => p.locator(sel).first().isVisible();

if (mode === 'live') {
  for (const [en, engineT] of [['chromium', chromium], ['webkit', webkit]]) {
    const b = await engineT.launch(); const ctx = await context(b, { viewport: { width: 390, height: 844 }, colorScheme: 'dark' }); const p = await ctx.newPage();
    // /check
    await p.goto(BASE + '/check'); await p.click('form button[type=submit]');
    ok(`${en} /check: empty → asks for the reference`, (await txt(p, '[data-err]')).includes('Type the reference'));
    await p.fill('#chk-ref', 'JV-ZZZZ-ZZZZ'); await p.click('form button[type=submit]'); await p.waitForSelector('[data-state="none"]:not([hidden])', { timeout: 15000 }).catch(() => {});
    ok(`${en} /check: a made-up reference → NOT ONE OF OURS (live engine)`, await visible(p, '[data-state="none"]'), (await visible(p, '[data-err]')) ? await txt(p, '[data-err]') : '');
    // /invited
    await p.goto(BASE + '/invited'); await p.fill('#inv-code', 'ZZZZZZ'); await p.click('[data-invite] button[type=submit]'); await p.waitForTimeout(2500);
    ok(`${en} /invited: a made-up code → "Someone" (live engine)`, (await txt(p, 'h1')).startsWith('Someone has invited you') && !(await visible(p, '[data-invite] [data-err]')), (await visible(p, '[data-invite] [data-err]')) ? await txt(p, '[data-invite] [data-err]') : await txt(p, 'h1'));
    await p.goto(BASE + '/invited?c=ZZZZZZ'); await p.waitForTimeout(2500);
    ok(`${en} /invited?c=: read from a link the same way`, (await p.inputValue('#inv-code')) === 'ZZZZZZ' && (await txt(p, 'h1')).startsWith('Someone'));
    // /recover
    await p.goto(BASE + '/recover'); await p.click('[data-send]');
    ok(`${en} /recover: empty → "Enter your email or mobile number."`, (await txt(p, '#rc-front-err')) === 'Enter your email or mobile number.');
    await p.fill('#rc-dest', 'not an address'); await p.click('[data-send]');
    ok(`${en} /recover: nonsense → "Check the email or mobile number."`, (await txt(p, '#rc-front-err')) === 'Check the email or mobile number.');
    await p.fill('#rc-dest', `nobody-${en}@example.com`); await p.click('[data-send]'); await p.waitForSelector('[data-sent]:not([hidden])', { timeout: 15000 }).catch(() => {});
    ok(`${en} /recover: a stranger gets the same answer as a contact (live engine)`, await visible(p, '[data-sent]'), await txt(p, '[data-sent] p[role=status]'));
    if (await visible(p, '[data-sent]')) { await p.fill('#rc-code', '000000'); await p.click('[data-verify]'); await p.waitForTimeout(3000); }
    const ce = (await visible(p, '[data-sent]')) ? await txt(p, '#rc-code-err') : 'not reached: ' + await txt(p, '#rc-front-err');
    ok(`${en} /recover: a wrong code is refused, with tries left (live engine)`, /isn’t right|Too many tries/.test(ce), ce);
    // /recover/answer
    await p.goto(BASE + '/recover/answer'); ok(`${en} /recover/answer: no link → "This link doesn’t work any more."`, await visible(p, '[data-state="gone"]'));
    await p.goto(BASE + '/recover/answer?r=00000000-0000-0000-0000-000000000000&t=made-up'); await p.waitForSelector('[data-state="gone"]:not([hidden]), [data-state="trouble"]:not([hidden])', { timeout: 15000 }).catch(() => {});
    ok(`${en} /recover/answer: a made-up link → "doesn’t work any more" (live engine)`, await visible(p, '[data-state="gone"]'), (await visible(p, '[data-state="trouble"]')) ? await txt(p, '[data-trouble]') : '');
    out.cookies.push(...(await ctx.cookies()));
    await b.close();
  }
} else {
  // Canned answers from the note. Each scenario: path, actions to drive, the state to capture.
  const later = new Date(Date.now() + 2.2 * 86400000).toISOString();
  const people = [{ recovery_contact_id: 'a', name: 'Uma', status: 'none', hold_until: null }, { recovery_contact_id: 'b', name: 'Arjun', status: 'waiting', hold_until: later }];
  const engineMock = (scn) => (body) => {
    const a = body.action;
    if (a === 'check') return [200, body.reference.toUpperCase().replace(/\s/g, '') === 'JV-7Q2M-4KDX' ? { ok: true, real: true, sent_to: 'r•••@g•••.com', sent_on: '2026-10-01', sent_at: '2026-10-01T09:14:03Z', about: 'Uma asked you to be a recovery contact', channel: 'email' } : { ok: true, real: false }];
    if (a === 'invite_name') return [200, { ok: true, name: body.code === 'K7M2QX' ? 'Tara' : 'Someone' }];
    if (a === 'consent_view') return [200, { ok: true, owner_name: 'Uma', state: scn.consent || 'pending', known_by: { channel_type: 'email', masked: 'ravi.k•••@gmail.com' }, second: null }];
    if (a === 'consent_answer') return [200, { ok: true, decision: body.decision, known_by: { channel_type: 'email', masked: 'ravi.k•••@gmail.com' } }];
    if (a === 'consent_add_start') return [200, { ok: true, challenge_id: 'c1', channel_type: 'mobile' }];
    if (a === 'consent_add_confirm') return [200, { ok: true, verified: true }];
    if (a === 'door_code_start') return [200, { ok: true, attempt_id: 'x' }];
    if (a === 'door_code_verify') return [200, body.code === '111111' ? { ok: true, verified: true, session: 's' } : { ok: true, verified: false, attempts_left: 4, too_many: false }];
    if (a === 'door_people') return [200, { ok: true, people: scn.people || people }];
    if (a === 'door_start') return [200, { ok: true, started: true, hold_until: later }];
    if (a === 'door_send_digits') return [200, { ok: true, sent_to: 'ravi.k•••@gmail.com' }];
    if (a === 'door_step_down') return [200, { ok: true }];
    if (a === 'door_update_start') return [200, { ok: true, challenge_id: 'u1', channel_type: 'email' }];
    if (a === 'door_update_confirm') return [200, { ok: true, verified: true, updated: true }];
    return [400, { ok: false, error: 'UNKNOWN' }];
  };
  const toPeople = async p => { await p.goto(BASE + '/recover'); await p.fill('#rc-dest', 'ravi@example.com'); await p.click('[data-send]'); await p.fill('#rc-code', '111111'); await p.click('[data-verify]'); await p.waitForSelector('[data-state="people"]:not([hidden])'); };
  const SC = [
    ['check-real', {}, async p => { await p.goto(BASE + '/check'); await p.fill('#chk-ref', 'jv-7q2m-4kdx'); await p.click('form button[type=submit]'); await p.waitForSelector('[data-state="real"]:not([hidden])'); }],
    ['check-none', {}, async p => { await p.goto(BASE + '/check'); await p.fill('#chk-ref', 'JV-7Q2M-4KDZ'); await p.click('form button[type=submit]'); await p.waitForSelector('[data-state="none"]:not([hidden])'); }],
    ['invited-tara', {}, async p => { await p.goto(BASE + '/invited?c=K7M2QX'); await p.waitForFunction(() => document.querySelector('[data-inviter]').textContent === 'Tara'); }],
    ['rc01-ask', {}, async p => { await p.goto(BASE + '/recover/answer?r=1&t=2'); await p.waitForSelector('[data-state="agree"]:not([hidden])'); }],
    ['rc02-yes', {}, async p => { await p.goto(BASE + '/recover/answer?r=1&t=2'); await p.click('[data-yes]'); await p.waitForSelector('[data-state="yes"]:not([hidden])'); }],
    ['rc02-added', {}, async p => { await p.goto(BASE + '/recover/answer?r=1&t=2'); await p.click('[data-yes]'); await p.fill('#rc-add-mob', '98100 04321'); await p.click('[data-add-btn]'); await p.fill('[data-add-code]', '123456'); await p.click('[data-add-btn]'); await p.waitForSelector('[data-added]:not([hidden])'); }],
    ['rc03-no', {}, async p => { await p.goto(BASE + '/recover/answer?r=1&t=2'); await p.click('[data-no]'); await p.waitForSelector('[data-state="no"]:not([hidden])'); }],
    ['rc04-front-sent', {}, async p => { await p.goto(BASE + '/recover'); await p.fill('#rc-dest', 'ravi@example.com'); await p.click('[data-send]'); await p.waitForSelector('[data-sent]:not([hidden])'); }],
    ['rc04-wrong-code', {}, async p => { await p.goto(BASE + '/recover'); await p.fill('#rc-dest', 'ravi@example.com'); await p.click('[data-send]'); await p.fill('#rc-code', '000000'); await p.click('[data-verify]'); await p.waitForSelector('#rc-code-err:not([hidden])'); }],
    ['rc05-people', {}, toPeople],
    ['rc05-wait-over', { people: [{ recovery_contact_id: 'a', name: 'Uma', status: 'wait_over', hold_until: null }] }, toPeople],
    ['rc06a-name', {}, async p => { await toPeople(p); await p.click('text=Start Uma’s way back in'); await p.fill('#rc-name', 'Umaa'); await p.click('[data-name-go]'); await p.waitForSelector('#rc-name-err:not([hidden])'); }],
    ['rc06b-warn', {}, async p => { await toPeople(p); await p.click('text=Start Uma’s way back in'); await p.fill('#rc-name', 'uma'); await p.click('[data-name-go]'); await p.waitForSelector('[data-state="warn"]:not([hidden])'); }],
    ['rc06c-started', {}, async p => { await toPeople(p); await p.click('text=Start Uma’s way back in'); await p.fill('#rc-name', 'Uma'); await p.click('[data-name-go]'); await p.click('[data-start]'); await p.waitForSelector('[data-state="started"]:not([hidden])'); }],
    ['rc07-digits', { people: [{ recovery_contact_id: 'a', name: 'Uma', status: 'wait_over', hold_until: null }] }, async p => { await toPeople(p); await p.click('text=Send the 6 digits'); await p.waitForSelector('[data-state="digits"]:not([hidden])'); }],
    ['rc08a-stepdown', {}, async p => { await toPeople(p); await p.click('text=Stop being Uma’s recovery contact'); await p.waitForSelector('[data-pop="stop"]:not([hidden])'); }],
    ['rc08b-stepped', {}, async p => { await toPeople(p); await p.click('text=Stop being Uma’s recovery contact'); await p.click('[data-stop-go]'); await p.waitForSelector('[data-state="stepped"]:not([hidden])'); }],
    ['rc09-update', {}, async p => { await toPeople(p); await p.click('[data-to-update]'); await p.fill('#rc-upd-mail', 'ravi.new@example.com'); await p.click('[data-upd="mail"] [data-upd-btn]'); await p.fill('[data-upd="mail"] [data-upd-code]', '123456'); await p.click('[data-upd="mail"] [data-upd-btn]'); await p.waitForSelector('[data-upd="mail"] [data-upd-saved]:not([hidden])'); }],
  ];
  const only = process.argv.slice(4); if (only.length) SC.splice(0, SC.length, ...SC.filter(x => only.some(o => x[0].startsWith(o))));
  const DIR = 'proofs/screens/doors'; mkdirSync(DIR, { recursive: true });
  const b = await chromium.launch();
  for (const [dev, vp] of Object.entries({ phone: { width: 390, height: 844 }, laptop: { width: 1440, height: 900 } })) for (const theme of ['dark', 'light']) {
    for (const [name, scn, drive] of SC) {
      const ctx = await context(b, { viewport: vp, colorScheme: theme, reducedMotion: 'reduce' }, engineMock(scn)); const p = await ctx.newPage();
      try { await drive(p); await p.waitForTimeout(250); ok(`mock ${dev}/${theme} ${name}`, true); }
      catch (e) { ok(`mock ${dev}/${theme} ${name}`, false, e.message.split('\n')[0]); }
      await p.screenshot({ path: `${DIR}/${name}-${dev}-${theme}.png`, fullPage: true });
      const axe = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      axe.violations.forEach(v => out.axe.push({ name, dev, theme, id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target.join(' ')).slice(0, 3) }));
      out.cookies.push(...(await ctx.cookies())); await ctx.close();
    }
  }
  await b.close();
}
mkdirSync('proofs', { recursive: true });
writeFileSync(`proofs/doors-${mode}-${siteHost.replace(/[:.]/g, '_')}.json`, JSON.stringify(out, null, 1));
console.log(out.results.join('\n'));
console.log('requests by host:', JSON.stringify(out.requests));
console.log('requests to any other host:', out.offHost.length, out.offHost.slice(0, 5).join(' '));
console.log('cookies:', out.cookies.length);
if (mode === 'mock') { console.log('axe violations:', out.axe.length); out.axe.slice(0, 10).forEach(v => console.log('  ', v.id, v.impact, v.name, v.dev, v.theme, v.nodes.join(' | '))); }
if (out.results.some(r => r.startsWith('FAIL'))) process.exitCode = 1;
