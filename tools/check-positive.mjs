// cc-website-02 JOB 2 (row 833): the positive paths on https://jeevanto.com, on ENGINES' test identities only
// (cc-wave-25-to-website-the-positive-paths-2026-10-02.md). Real browsers, nothing intercepted.
//
//   STATE=<dir outside both repos> APP=<a checkout of the app repo's master> node tools/check-positive.mjs run
//   STATE=<same dir> APP=<same> node tools/check-positive.mjs teardown      (the accounts, ten minutes apart, then the inboxes)
//
// The run opens three throwaway inboxes at mail.tm (the contact, the owners' alert inbox, and the contact's new address
// for "update"), then has ENGINES' tool make three test owners called Uma (A, B, C) who each ask the contact inbox,
// and three test accounts called Asha with invite codes. Then, as the contact:
//   A: /check with the ask mail's reference → real; /invited with Asha's code → "Asha"; the ask link → yes
//   B: the ask link → no (WebKit)              C: the ask link → yes
//   door session 1: start A's way back in (type "Uma") → started
//   door session 2: A is waiting; C is idle → step down from C → stepped
//   door session 3: A is waiting → update the email (the code from the new inbox) → saved → back to people after
//                   A's ten-minute test hold → the wait is over → send the 6 digits → they arrive
// Three door codes in all (the limit is ten an hour per visitor). No address, code, link or reference is written to the
// proof: inboxes appear as ‹contact›, ‹alert›, ‹new›.
import { chromium, webkit } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import engine from '../src/lib/engine.json' with { type: 'json' };

const BASE = 'https://jeevanto.com', MAIL = 'https://api.mail.tm';
const { STATE, APP } = process.env; if (!STATE || !APP) { console.error('STATE=<dir> APP=<app checkout> node tools/check-positive.mjs run|teardown'); process.exit(2); }
mkdirSync(STATE, { recursive: true });
const sfile = join(STATE, 'state.json');
const S = existsSync(sfile) ? JSON.parse(readFileSync(sfile, 'utf8')) : {};
const save = () => writeFileSync(sfile, JSON.stringify(S, null, 1));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [], requests = {}, offHost = [];
const mask = s => String(s).replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g, m => Object.entries(S.inbox || {}).find(([, v]) => v.address === m)?.[0] ? `‹${Object.entries(S.inbox).find(([, v]) => v.address === m)[0]}›` : '‹address›')
  .replace(/JV-[A-Z0-9]{4}-[A-Z0-9]{4}/g, 'JV-‹ref›').replace(/[?&]t=[^&\s]+/g, '&t=‹token›');
const ok = (name, cond, extra = '') => { const l = `${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + mask(extra) : ''}`; results.push(l); console.log(l); return cond; };
const log = m => console.log(`[${new Date().toISOString().slice(11, 19)}] ${mask(m)}`);

// ── mail.tm ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function mt(path, { method = 'GET', token, body } = {}) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(MAIL + path, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 429) { await sleep(2000); continue; }
    if (r.status === 204) return {};
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`mail.tm ${method} ${path} ${r.status}`); return j;
  }
  throw new Error('mail.tm rate-limited');
}
async function openInbox(role) {
  const domain = (await mt('/domains'))['hydra:member'][0].domain;
  const address = `jv-web-${role}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@${domain}`;
  const password = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const acct = await mt('/accounts', { method: 'POST', body: { address, password } });
  const { token } = await mt('/token', { method: 'POST', body: { address, password } });
  return { address, password, id: acct.id, token };
}
// Wait for a message in an inbox that arrived after `since` and passes `want`; returns its full text.
async function waitMail(role, since, want, label, limitMs = 240000) {
  const box = S.inbox[role], t0 = Date.now();
  while (Date.now() - t0 < limitMs) {
    const list = (await mt('/messages', { token: box.token }))['hydra:member'] || [];
    for (const m of list) {
      if (new Date(m.createdAt) < new Date(since - 5000) || (S.seen ||= []).includes(m.id)) continue;
      const full = await mt('/messages/' + m.id, { token: box.token });
      const text = [full.subject, full.text, ...(full.html || [])].join('\n').replace(/&amp;/g, '&');
      if (want(text, full)) { S.seen.push(m.id); save(); log(`mail in ‹${role}›: "${full.subject}" (${label})`); return { text, subject: full.subject }; }
    }
    await sleep(4000);
  }
  throw new Error(`no mail in ‹${role}› for ${label} within ${limitMs / 1000}s`);
}

// ── ENGINES' fixtures (run from the app checkout; its env file names the Mumbai project) ─────────────────────────────
function make(tag) {
  const scratch = join(STATE, `fixtures-${tag}.json`);
  const outp = execFileSync('node', ['scripts/verify/wave25/website-fixtures.mjs', 'make', '--contact', S.inbox.contact.address, '--owner-alert', S.inbox.alert.address],
    { cwd: APP, env: { ...process.env, W11C_SCRATCH: scratch, JEEVANTO_REPO: process.env.JEEVANTO_REPO || APP }, encoding: 'utf8' });
  const code = (outp.match(/"invite_code":\s*"([^"]+)"/) || [])[1];
  S.made ||= {}; S.made[tag] = { scratch, code, at: Date.now() }; save();
  log(`make ${tag}: ${outp.split('\n').filter(l => /F[12] ·|steps|PASS|FAIL|✓|✗/.test(l)).join(' | ').slice(0, 300)}`);
  return code;
}
async function askMail(tag) {
  const m = await waitMail('contact', S.made[tag].at, t => /recovery contact/i.test(t) && /recover\/answer\?r=/.test(t), `the ask, ${tag}`);
  const ref = (m.text.match(/JV-[A-Z0-9]{4}-[A-Z0-9]{4}/) || [])[0];
  const link = (m.text.match(/https:\/\/jeevanto\.com\/recover\/answer\?r=[^\s"'<>)\]]+/) || [])[0];
  S.made[tag].ref = ref; S.made[tag].link = link; S.made[tag].subject = m.subject; save();
  return { ref, link, subject: m.subject };
}

// ── the browser ───────────────────────────────────────────────────────────────────────────────────────────────────
const siteHost = 'jeevanto.com', engineHost = new URL(engine.url).host;
async function browse(engineT, fn) {
  const b = await engineT.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  ctx.on('request', r => { const h = new URL(r.url()).host; requests[h] = (requests[h] || 0) + 1; if (h !== siteHost && h !== engineHost && !r.url().startsWith('data:')) offHost.push(r.url()); });
  const p = await ctx.newPage();
  try { return await fn(p); } finally { const c = await ctx.cookies(); if (c.length) ok('no cookie', false, c.map(x => x.name).join(' ')); await b.close(); }
}
const shown = (p, sel, t = 20000) => p.waitForSelector(sel + ':not([hidden])', { timeout: t }).then(() => true, () => false);
const text = (p, sel) => p.locator(sel).first().innerText().catch(() => '');

async function doorSession(p, label) {
  await p.goto(BASE + '/recover');
  const t0 = Date.now();
  await p.fill('#rc-dest', S.inbox.contact.address); await p.click('[data-send]');
  ok(`${label}: the door code is asked for`, await shown(p, '[data-sent]'), await text(p, '#rc-front-err'));
  const m = await waitMail('contact', t0, t => /\b\d{6}\b/.test(t) && !/recover\/answer\?r=/.test(t), `door code, ${label}`);
  await p.fill('#rc-code', m.text.match(/\b(\d{6})\b/)[1]); await p.click('[data-verify]');
  return ok(`${label}: the code arrives in ‹contact› and opens "your people"`, await shown(p, '[data-state="people"]'), await text(p, '#rc-code-err'));
}
const rows = p => p.$$eval('[data-list] > *', els => els.map(e => ({ name: e.querySelector('[data-p="name"]')?.textContent, status: e.querySelector('[data-p="status"]')?.textContent })));

// ── run ───────────────────────────────────────────────────────────────────────────────────────────────────────────
if (process.argv[2] === 'run') {
  if (!S.inbox) { S.inbox = { contact: await openInbox('contact'), alert: await openInbox('alert'), new: await openInbox('new') }; save(); log('three inboxes opened at mail.tm'); }

  // A: the reference, the inviter, yes
  make('A'); const A = await askMail('A');
  ok('A: the real ask mail arrives in ‹contact›, with a reference and the answer link', !!A.ref && !!A.link, `"${A.subject}"`);
  for (const [en, E] of [['chromium', chromium], ['webkit', webkit]]) await browse(E, async p => {
    await p.goto(BASE + '/check'); await p.fill('#chk-ref', A.ref); await p.click('form button[type=submit]');
    const real = await shown(p, '[data-state="real"]');
    ok(`${en} /check: the ask's reference → THIS IS REAL`, real, real ? `sent to ${await text(p, '[data-f="sent_to"]')}, about "${await text(p, '[data-f="about"]')}"` : await text(p, '[data-err]'));
    await p.goto(BASE + '/invited?c=' + encodeURIComponent(S.made.A.code));
    await p.waitForFunction(() => document.querySelector('[data-inviter]')?.textContent && document.querySelector('[data-inviter]').textContent !== 'Someone', null, { timeout: 15000 }).catch(() => {});
    ok(`${en} /invited?c=<Asha's code> → names "Asha"`, (await text(p, '[data-inviter]')) === 'Asha', await text(p, 'h1'));
  });
  await browse(chromium, async p => {
    await p.goto(A.link); ok('chromium the ask link (A) → "Uma" asks, pending', await shown(p, '[data-state="agree"]'), await text(p, 'h1'));
    await p.click('[data-yes]'); const y = await shown(p, '[data-state="yes"]');
    ok('chromium A: yes → "We’ll know you by" the masked email; the other channel offered', y && /We’ll know you by/.test(await text(p, '[data-known]')) && await shown(p, '[data-add-mob]', 3000), await text(p, '[data-known]'));
    await p.goto(A.link); ok('chromium A: the link again → still yes', await shown(p, '[data-state="yes"]'));
  });

  // door session 1: start A
  await browse(chromium, async p => {
    if (!await doorSession(p, 'session 1')) return;
    const r = await rows(p); ok('session 1: people lists Uma, nothing happening', r.length === 1 && r[0].name === 'Uma' && r[0].status === 'Nothing happening', JSON.stringify(r));
    await p.click('[data-list] > * [data-p="start"]'); await p.fill('#rc-name', 'Umaa'); await p.click('[data-name-go]');
    ok('session 1: a wrong name is refused', await shown(p, '#rc-name-err', 3000));
    await p.fill('#rc-name', 'uma'); await p.click('[data-name-go]'); ok('session 1: "uma" → the warning', await shown(p, '[data-state="warn"]'));
    await p.click('[data-start]'); const st = await shown(p, '[data-state="started"]');
    S.startedAt = Date.now(); save();
    ok('session 1: Start → "started"', st, st ? await text(p, '[data-state="started"] h1') : await text(p, '[data-warn-err]'));
  });

  // C: yes; B: no (WebKit)
  make('C'); const C = await askMail('C');
  await browse(chromium, async p => { await p.goto(C.link); await shown(p, '[data-state="agree"]'); await p.click('[data-yes]'); ok('chromium C: yes', await shown(p, '[data-state="yes"]')); });
  make('B'); const B = await askMail('B');
  await browse(webkit, async p => {
    await p.goto(B.link); ok('webkit B: the ask link → pending', await shown(p, '[data-state="agree"]'));
    await p.click('[data-no]'); ok('webkit B: No, thank you → "no"', await shown(p, '[data-state="no"]'), await text(p, '[data-state="no"] h1'));
    await p.goto(B.link); ok('webkit B: the link again → still no', await shown(p, '[data-state="no"]'));
  });

  // door session 2: step down from C
  await browse(chromium, async p => {
    if (!await doorSession(p, 'session 2')) return;
    const r = await rows(p);
    ok('session 2: people lists A waiting and C idle, not B', r.length === 2 && r.some(x => /^Started\./.test(x.status)) && r.some(x => x.status === 'Nothing happening'), JSON.stringify(r));
    const idle = r.findIndex(x => x.status === 'Nothing happening');
    await p.locator('[data-list] > *').nth(idle).locator('[data-p="stop"]').click(); await p.click('[data-stop-go]');
    ok('session 2: step down from C → "stepped"', await shown(p, '[data-state="stepped"]'), await text(p, '[data-stop-err]'));
  });

  // door session 3: the wait, update, the digits
  await browse(chromium, async p => {
    if (!await doorSession(p, 'session 3')) return;
    let r = await rows(p);
    ok('session 3: Uma alone, waiting ("Started. …")', r.length === 1 && /^Started\./.test(r[0].status), JSON.stringify(r));
    await p.click('[data-to-update]'); ok('session 3: Update my email or mobile', await shown(p, '[data-state="update"]'));
    const wait = S.startedAt + 10.5 * 60000 - Date.now(); if (wait > 0) { log(`waiting ${Math.round(wait / 1000)}s for Uma's test hold`); await sleep(wait); }
    const card = '[data-upd="mail"]', t0 = Date.now();
    await p.fill('#rc-upd-mail', S.inbox.new.address); await p.click(`${card} [data-upd-btn]`);
    ok('session 3: update → a code is sent to the new address', await shown(p, `${card} [data-upd-code]`), await text(p, `${card} [data-upd-err]`));
    const m = await waitMail('new', t0, t => /\b\d{6}\b/.test(t), 'update code');
    await p.fill(`${card} [data-upd-code]`, m.text.match(/\b(\d{6})\b/)[1]); await p.click(`${card} [data-upd-btn]`);
    ok('session 3: the code from ‹new› → saved', await shown(p, `${card} [data-upd-saved]`), await text(p, `${card} [data-upd-err]`));
    await p.click('[data-to-people]'); await shown(p, '[data-state="people"]');
    r = await rows(p); ok('session 3: after the hold → "The wait is over."', r.length === 1 && r[0].status === 'The wait is over.', JSON.stringify(r));
    const t1 = Date.now(); await p.click('[data-list] > * [data-p="send"]');
    const d = await shown(p, '[data-state="digits"]');
    ok('session 3: Send the 6 digits → "digits", sent to the masked address', d, d ? await text(p, '[data-sent-to]') : await text(p, '[data-list] [data-p="err"]'));
    const where = await Promise.any(['new', 'contact'].map(role => waitMail(role, t1, t => /\b\d{6}\b/.test(t) && !/recover\/answer\?r=/.test(t), 'the digits', 180000).then(() => role)));
    ok('session 3: the digits arrive, at the updated address', where === 'new', `in ‹${where}›`);
  });

  writeFileSync('proofs/positive-live.txt', [`cc-website-02 JOB 2 — the positive paths on ${BASE}, ${new Date().toISOString()}`, ...results,
    `requests by host: ${JSON.stringify(requests)}`, `requests to any other host: ${offHost.length}`].join('\n') + '\n');
  console.log(`\n${results.filter(r => r.startsWith('PASS')).length}/${results.length} passed · other hosts: ${offHost.length}`);
  if (results.some(r => r.startsWith('FAIL')) || offHost.length) process.exitCode = 1;
} else if (process.argv[2] === 'teardown') {
  let first = true;
  for (const [tag, m] of Object.entries(S.made || {})) {
    if (m.tornDown) continue;
    if (!first) { log('ten minutes before the next purge (the estate\'s rule holds across files too)'); await sleep(600_000); } first = false;
    log(`teardown ${tag}`);
    const outp = execFileSync('node', ['scripts/verify/wave25/website-fixtures.mjs', 'teardown'], { cwd: APP, env: { ...process.env, W11C_SCRATCH: m.scratch, JEEVANTO_REPO: process.env.JEEVANTO_REPO || APP }, encoding: 'utf8' });
    log(outp.split('\n').filter(Boolean).slice(-4).join(' | ')); m.tornDown = true; save();
  }
  for (const [role, box] of Object.entries(S.inbox || {})) { if (box.deleted) continue; await mt('/accounts/' + box.id, { method: 'DELETE', token: box.token }); box.deleted = true; save(); log(`inbox ‹${role}› deleted`); }
} else { console.error('run | teardown'); process.exit(2); }
