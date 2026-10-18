// cc-website-02 JOB 2 (row 833): the positive paths on https://jeevanto.com, on ENGINES' test identities only
// (cc-wave-25-to-website-the-positive-paths-2026-10-02.md). Real browsers, nothing intercepted.
//
//   STATE=<dir outside both repos> APP=<a checkout of the app repo's master> node tools/check-positive.mjs run
//   STATE=<same dir> APP=<same> node tools/check-positive.mjs teardown      (the accounts, ten minutes apart; ~60 min for three)
//
// The run makes three plus-tags of ENGINES' test Gmail inbox (decision 266; Cowork 12 Oct 11:20 (a)): the contact, the
// owners' alert inbox and the contact's new address for "update". Every email is read with ENGINES' narrow reader
// (scripts/verify/engines-kit/gmail-reader.mjs in APP): the ask's reference and link, and each code, the real way
// (decision 264). mail.tm is gone. The base address comes from Gmail's profile at run time and is never printed; then has ENGINES' tool make three test owners called Uma (A, B, C) who each ask the contact inbox,
// and three test accounts called Asha with invite codes. Then, as the contact:
//   A: /check with the ask mail's reference → real; /invited with Asha's code → "Asha Website" (254); the ask link → yes
//   B: the ask link → no (WebKit)              C: the ask link → yes
//   door session 1: start A's way back in (type "uma website": the whole name, decision 254) → started
//   door session 2: A is waiting; C is idle → step down from C → stepped
//   door session 3: A is waiting → update the email (the code from the new inbox) → saved → back to people after
//                   A's ten-minute test hold → the wait is over → send the 6 digits → they arrive
// NO_CODES=1 skips the three door sessions (each needs an emailed code). Until ENGINES' 266 drive note, a code must come
// the real way (decision 264), so those legs wait; they're recorded as WAITS, never as PASS (Cowork, 12 Oct 08:32).
// Three door codes in all (the limit is ten an hour per visitor). No address, code, link or reference is written to the
// proof: inboxes appear as ‹contact›, ‹alert›, ‹new›.
import { chromium, webkit } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import engine from '../src/lib/engine.json' with { type: 'json' };

const BASE = 'https://jeevanto.com', SENDER = 'notifications@jeevanto.com';
const { STATE, APP } = process.env; if (!STATE || !APP) { console.error('STATE=<dir> APP=<app checkout> node tools/check-positive.mjs run|teardown'); process.exit(2); }
mkdirSync(STATE, { recursive: true });
const sfile = join(STATE, 'state.json');
const S = existsSync(sfile) ? JSON.parse(readFileSync(sfile, 'utf8')) : {};
const save = () => writeFileSync(sfile, JSON.stringify(S, null, 1));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const NO_CODES = process.env.NO_CODES === '1';
// ONLY_A=1: owner A's path only (the ask, session 1's start, the hold, session 3's update and digits): no B or C, no
// session 2, so one test owner and a ~20 min teardown. For re-driving one step; the skipped legs are SKIPPED, never PASS.
const ONLY_A = process.env.ONLY_A === '1';
// ONLY_B=1 (rows 908, 501, 833; ENGINES 17 Oct 23:0x): owner B's decline alone, the 4 Oct run's one FAIL. One owner
// signs up the app's way and asks ‹contact›; WebKit opens the ask, says No, thank you, and opens the link again: it
// must still say no (20262055: recovery_consent_view answers `declined` with the asker's name), never "doesn't work
// any more". No door session, no emailed door code: it fits one live turn with its purge.
const ONLY_B = process.env.ONLY_B === '1';
// ONLY_YES=1 (F-257, TESTS 18 Oct): owner A's ask and the contact's yes alone: what the page knows them by, on the yes
// and on the reopened link, must both be a masked email. One owner, no Asha, no door session: one live turn.
const ONLY_YES = process.env.ONLY_YES === '1';
if ([ONLY_A, ONLY_B, ONLY_YES].filter(Boolean).length > 1) { console.error('ONLY_A and ONLY_B are separate runs'); process.exit(2); }
// EXPIRE_SESSION=1 (with ONLY_A; row 1133, Cowork 15 Oct 23:55 (b)): the honest real-life NOT_FOUND. A person leaves the
// page open past the door session's life (live: recovery_setting door_session_minutes = 30, ENGINES 16 Oct 00:5x), then
// taps "Send the 6 digits". The door answers 409 NOT_FOUND (its session check sits in _door_contact), and the page must
// say the founder's words for it (15 Oct 22:10, WEB-1), never "couldn't reach". The contact can't be removed mid-flow
// instead: live refuses that while the recovery is live (RECOVERY_LIVE_FLOW), by design.
const EXPIRE_SESSION = process.env.EXPIRE_SESSION === '1';
const DOOR_SESSION_MIN = 30;
const NOT_FOUND_WORDS = 'We couldn’t send the 6 digits. Write to help@jeevanto.com, and we’ll look into it.';
const results = [], requests = {}, offHost = [], doorLog = [];
// a masked email as the pages draw it: one letter, the mask's dots, '@', one letter, dots, the domain (F-555, F-255)
const MASKED_EMAIL = /^\S•+@\S•+\.[a-z]{2,}$/;
const shape = v => MASKED_EMAIL.test(String(v).trim()) ? 'a masked email' : `NOT a masked email (${String(v).replace(/\d/g, '#').replace(/[A-Za-z]/g, 'x').slice(0, 40)})`;
const mask = s => String(s).replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g, m => Object.entries(S.inbox || {}).find(([, v]) => v.address === m)?.[0] ? `‹${Object.entries(S.inbox).find(([, v]) => v.address === m)[0]}›` : '‹address›')
  .replace(/JV-[A-Z0-9]{4}-[A-Z0-9]{4}/g, 'JV-‹ref›').replace(/[?&]t=[^&\s]+/g, '&t=‹token›');
const ok = (name, cond, extra = '') => { const l = `${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + mask(extra) : ''}`; results.push(l); console.log(l); return cond; };
const log = m => console.log(`[${new Date().toISOString().slice(11, 19)}] ${mask(m)}`);

// ── the test Gmail inbox (ENGINES' narrow reader) ──────────────────────────────────────────────────────────────────
const G = await import(join(APP, 'scripts/verify/engines-kit/gmail-reader.mjs'));
// These tags are never accounts: they're the recovery contact's addresses that ENGINES' test owners write to (and the
// contact's new address). test_identity_of (20262137) decides whether an ACCOUNT is a test identity, so it doesn't
// apply here. The fixtures' teardown purges the owners and what they stored. Mail to a plus-tag takes the real send
// path (only @jeevanto-test.local goes to the sink), which is what decision 264 asks; the reader reads only a plus-tag.
async function openInbox(role) {  // a fresh plus-tag of the test inbox; nothing is created anywhere
  const [local, domain] = (await G.inboxAddress()).split('@');
  const address = `${local.split('+')[0]}+jvweb${role}${Date.now().toString(36)}@${domain}`;
  return { address };
}
// Anything Gmail doesn't put in Primary is a deliverability finding (decision 266 step 3), recorded, never a pass.
const place = (label, where) => { if (where && where !== 'PRIMARY') results.push(`FINDING ${label}: Gmail filed it in ${where}, not Primary`); };
async function readCode(role, since, label) {
  const r = await G.readCodeFromGmail({ to: S.inbox[role].address, sender: SENDER, since: new Date(since - 5000), timeoutMs: 240000 });
  place(label, r.where); log(`code in ‹${role}› (${label}), filed in ${r.where}`); return r.code;
}

// ── the owners, made THE REAL WAY (Cowork 17 Oct 17:15 (b); live-turn skill §3; decisions 264/266/281) ─────────────
// Each owner signs up through the app's own email-code door with a fresh plus-tag of the test Gmail (TESTS' one helper,
// tools/owners.mjs → tests/readiness/lib/identity.mjs from TESTS_REPO, a checkout of the tests branch), names itself
// with the app's own calls, and asks (Uma) or invites (Asha) with the app's own doors under its own session. No admin
// API, no SQL writes (the old fixtures did both: a side door under 281). jeevanto.com talks to LIVE, so the owners are
// made on live (JV_TARGET=live, which the helper asserts against the env file's ref and logs to live-uses.log).
process.env.JV_TARGET = 'live';
const O = await import('./owners.mjs');
const ownersFile = join(STATE, 'owners.json');
async function make(tag) {
  const at = Date.now();
  const u = await O.ownerWhoAsks(`w25web${tag.toLowerCase()}`, S.inbox.contact.address);
  const owners = O.kept(ownersFile); owners.push(u.A); O.keep(ownersFile, owners);
  log(`make ${tag}: Uma signed up the app's way (${u.A.steps.filter(x => x.ok).length}/${u.A.steps.length} sign-up steps), named (auth ${u.named.auth}, account ${u.named.account}), asked → ${u.status}`);
  let code = null;
  if (tag === 'A' && !ONLY_YES) {
    const a = await O.ownerWhoInvites('w25webasha');
    const o2 = O.kept(ownersFile); o2.push(a.A); O.keep(ownersFile, o2);
    code = a.code;
    log(`make ${tag}: Asha signed up the app's way, named (auth ${a.named.auth}, account ${a.named.account}), invite code → ${a.status}${code ? '' : ' (NONE)'}`);
  }
  S.made ||= {}; S.made[tag] = { code, at }; save();
  if (!u.asked) throw new Error(`make ${tag}: the ask was refused (${u.status})`);
  return code;
}
async function askMail(tag) {  // ENGINES' readAskFromGmail returns only the reference and the answer link
  const a = await G.readAskFromGmail({ to: S.inbox.contact.address, sender: SENDER, since: new Date(S.made[tag].at - 5000), timeoutMs: 240000 });
  place(`the ask, ${tag}`, a.where); log(`the ask in ‹contact› (${tag}), filed in ${a.where}`);
  S.made[tag].ref = a.reference; S.made[tag].link = a.answerLink; save();
  return { ref: a.reference, link: a.answerLink, subject: `(not read: the reader returns the reference and link only), filed in ${a.where}` };
}

// ── the browser ───────────────────────────────────────────────────────────────────────────────────────────────────
const siteHost = 'jeevanto.com', engineHost = new URL(engine.url).host;
// The site's visit counter (decision 233) reports to cloudflareinsights.com. A drive is not a visit: its reports are
// answered here, never sent, and counted apart; any other outside host is still a fault.
const COUNTER = 'https://cloudflareinsights.com/cdn-cgi/rum';
async function browse(engineT, fn) {
  const b = await engineT.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(u => u.href.startsWith(COUNTER), route => route.fulfill({ status: 204, body: '' }));
  ctx.on('request', r => { if (r.url().startsWith(COUNTER)) { requests['cloudflareinsights.com (answered here, not sent)'] = (requests['cloudflareinsights.com (answered here, not sent)'] || 0) + 1; return; } const h = new URL(r.url()).host; requests[h] = (requests[h] || 0) + 1; if (h !== siteHost && h !== engineHost && !r.url().startsWith('data:')) offHost.push(r.url()); });
  // every engine door's answer: the action, the status and the error code only (never a body field that could hold an
  // address, code or link), so a refusal is named in the proof, not guessed (ENGINES, 12 Oct: a 409 hid its reason)
  ctx.on('response', async r => {
    const req = r.request(); if (new URL(r.url()).host !== engineHost || req.method() !== 'POST') return;
    let action = ''; try { action = JSON.parse(req.postData() || '{}').action || ''; } catch (e) {}
    let error = ''; try { const j = await r.json(); error = j && j.ok === false ? String(j.error || '') : ''; } catch (e) {}
    const line = `door ${action || '?'} → ${r.status()}${error ? ' ' + error : ''}`; doorLog.push(line); log(line);
  });
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
  await p.fill('#rc-code', await readCode('contact', t0, `door code, ${label}`)); await p.click('[data-verify]');
  return ok(`${label}: the code arrives in ‹contact› and opens "your people"`, await shown(p, '[data-state="people"]'), await text(p, '#rc-code-err'));
}
const rows = p => p.$$eval('[data-list] > *', els => els.map(e => ({ name: e.querySelector('[data-p="name"]')?.textContent, status: e.querySelector('[data-p="status"]')?.textContent })));

// ── run ───────────────────────────────────────────────────────────────────────────────────────────────────────────
if (process.argv[2] === 'run') {
  if (!S.inbox) { S.inbox = { contact: await openInbox('contact'), alert: await openInbox('alert'), new: await openInbox('new') }; save(); log('three plus-tags of the test Gmail inbox made'); }

  if (ONLY_B) {
  await make('B'); const B = await askMail('B');
  ok('B: the real ask mail arrives in ‹contact›, with the answer link', !!B.link, `"${B.subject}"`);
  await browse(webkit, async p => {
    await p.goto(B.link); ok('webkit B: the ask link → pending', await shown(p, '[data-state="agree"]'), await text(p, 'h1'));
    await p.click('[data-no]'); ok('webkit B: No, thank you → "no"', await shown(p, '[data-state="no"]'), await text(p, '[data-state="no"] h1'));
    await p.goto(B.link); const still = await shown(p, '[data-state="no"]');
    ok('webkit B: the link again → still no (row 908)', still, still ? await text(p, '[data-state="no"] h1') : `shows: ${await text(p, 'h1')}`);
  });
  results.push('SKIPPED A and C, and the three door sessions: ONLY_B run');
  } else {
  // A: the reference, the inviter, yes
  await make('A'); const A = await askMail('A');
  ok('A: the real ask mail arrives in ‹contact›, with a reference and the answer link', !!A.ref && !!A.link, `"${A.subject}"`);
  if (!ONLY_YES) for (const [en, E] of [['chromium', chromium], ['webkit', webkit]]) await browse(E, async p => {
    await p.goto(BASE + '/check'); await p.fill('#chk-ref', A.ref); await p.click('form button[type=submit]');
    const real = await shown(p, '[data-state="real"]');
    const sentToChk = real ? (await text(p, '[data-f="sent_to"]')).trim() : '';
    ok(`${en} /check: the ask's reference → THIS IS REAL, sent to a masked EMAIL`, real && MASKED_EMAIL.test(sentToChk), real ? `sent to ${shape(sentToChk)}, about "${await text(p, '[data-f="about"]')}"` : await text(p, '[data-err]'));
    await p.goto(BASE + '/invited?c=' + encodeURIComponent(S.made.A.code));
    await p.waitForFunction(() => document.querySelector('[data-inviter]')?.textContent && document.querySelector('[data-inviter]').textContent !== 'Someone', null, { timeout: 15000 }).catch(() => {});
    // decision 254: the whole first name, and an account with no separate first name gets its whole stored name, never a
    // first word. ENGINES' fixture saves "Asha Website" with no first name, so the page must say "Asha Website" (12 Oct).
    ok(`${en} /invited?c=<Asha's code> → names "Asha Website" (the whole name, decision 254)`, (await text(p, '[data-inviter]')) === 'Asha Website', await text(p, 'h1'));
  });
  await browse(chromium, async p => {
    await p.goto(A.link); ok('chromium the ask link (A) → "Uma" asks, pending', await shown(p, '[data-state="agree"]'), await text(p, 'h1'));
    await p.click('[data-yes]'); const y = await shown(p, '[data-state="yes"]');
    // the contact is an email, so what the page knows them by must LOOK like a masked email: a letter, the mask's dots, an
    // '@', then the domain masked. "•••• 8327" is the sealed token's tail masked as a phone (F-555's shape, on the accept
    // path): it passed here on 18 Oct 08:02 because this check read the words only (RECHECK-LIVE, row 833's gate).
    const known = y ? await text(p, '[data-known]') : '';
    const maskedEmail = /We’ll know you by \S•+@\S•+\.[a-z]{2,}/.test(known);
    ok('chromium A: yes → "We’ll know you by" a masked EMAIL (a letter, dots, @, a letter, dots, the domain); the other channel offered', y && maskedEmail && await shown(p, '[data-add-mob]', 3000), y ? `known by: ${maskedEmail ? 'a masked email' : 'NOT a masked email (' + known.replace(/\d/g, '#').replace(/[A-Za-z]/g, 'x') + ')'}` : await text(p, '[data-known]'));
    // F-257's second place: a reopened accepted link draws "We'll know you by" from recovery_consent_view's known_by
    await p.goto(A.link); const again = await shown(p, '[data-state="yes"]');
    const knownAgain = again ? await text(p, '[data-known]') : '';
    const maskedAgain = /We’ll know you by \S•+@\S•+\.[a-z]{2,}/.test(knownAgain);
    ok('chromium A: the link again → still yes, still known by a masked EMAIL (F-257, consent_view)', again && maskedAgain, again ? `known by: ${maskedAgain ? 'a masked email' : 'NOT a masked email (' + knownAgain.replace(/\d/g, '#').replace(/[A-Za-z]/g, 'x') + ')'}` : 'not the yes state');
  });

  if (ONLY_YES) results.push('SKIPPED /check, /invited, B and C, and the three door sessions: ONLY_YES run');
  else {
  // door session 1: start A
  await browse(chromium, async p => {
    if (NO_CODES) { results.push('WAITS session 1: needs an emailed door code (decision 264; ENGINES\' 266 drive note first)'); return; }
    if (!await doorSession(p, 'session 1')) return;
    const r = await rows(p); ok('session 1: people lists "Uma Website" (the whole name, decision 254), nothing happening', r.length === 1 && r[0].name === 'Uma Website' && r[0].status === 'Nothing happening', JSON.stringify(r));
    await p.click('[data-list] > * [data-p="start"]'); await p.fill('#rc-name', 'Umaa'); await p.click('[data-name-go]');
    ok('session 1: a wrong name is refused', await shown(p, '#rc-name-err', 3000));
    // decision 254: the first word alone is not the name; the whole name, in any case, is
    await p.fill('#rc-name', 'uma'); await p.click('[data-name-go]');
    ok('session 1: "uma" (the first word alone) is refused', await shown(p, '#rc-name-err', 3000) && !(await shown(p, '[data-state="warn"]', 1500)));
    await p.fill('#rc-name', 'uma website'); await p.click('[data-name-go]'); ok('session 1: "uma website" → the warning', await shown(p, '[data-state="warn"]'));
    await p.click('[data-start]'); const st = await shown(p, '[data-state="started"]');
    S.startedAt = Date.now(); save();
    ok('session 1: Start → "started"', st, st ? await text(p, '[data-state="started"] h1') : await text(p, '[data-warn-err]'));
  });

  if (ONLY_A) results.push('SKIPPED B and C (yes/no) and session 2 (step down): ONLY_A run');
  else {
  // C: yes; B: no (WebKit)
  await make('C'); const C = await askMail('C');
  await browse(chromium, async p => { await p.goto(C.link); await shown(p, '[data-state="agree"]'); await p.click('[data-yes]'); ok('chromium C: yes', await shown(p, '[data-state="yes"]')); });
  await make('B'); const B = await askMail('B');
  await browse(webkit, async p => {
    await p.goto(B.link); ok('webkit B: the ask link → pending', await shown(p, '[data-state="agree"]'));
    await p.click('[data-no]'); ok('webkit B: No, thank you → "no"', await shown(p, '[data-state="no"]'), await text(p, '[data-state="no"] h1'));
    await p.goto(B.link); ok('webkit B: the link again → still no', await shown(p, '[data-state="no"]'));
  });

  // door session 2: step down from C
  await browse(chromium, async p => {
    if (NO_CODES) { results.push('WAITS session 2: needs an emailed door code (decision 264; ENGINES\' 266 drive note first)'); return; }
    if (!await doorSession(p, 'session 2')) return;
    const r = await rows(p);
    ok('session 2: people lists A waiting and C idle, not B', r.length === 2 && r.some(x => /^Started\./.test(x.status)) && r.some(x => x.status === 'Nothing happening'), JSON.stringify(r));
    const idle = r.findIndex(x => x.status === 'Nothing happening');
    await p.locator('[data-list] > *').nth(idle).locator('[data-p="stop"]').click(); await p.click('[data-stop-go]');
    ok('session 2: step down from C → "stepped"', await shown(p, '[data-state="stepped"]'), await text(p, '[data-stop-err]'));
  });

  }

  // door session 3: the wait, update, the digits
  await browse(chromium, async p => {
    if (NO_CODES) { results.push('WAITS session 3: needs an emailed door code (decision 264; ENGINES\' 266 drive note first)'); return; }
    if (!await doorSession(p, 'session 3')) return;
    const doorAt = Date.now();   // the door code was accepted: the door session's life starts here
    let r = await rows(p);
    ok('session 3: Uma alone, waiting ("Started. …")', r.length === 1 && /^Started\./.test(r[0].status), JSON.stringify(r));
    await p.click('[data-to-update]'); ok('session 3: Update my email or mobile', await shown(p, '[data-state="update"]'));
    const wait = S.startedAt + 10.5 * 60000 - Date.now(); if (wait > 0) { log(`waiting ${Math.round(wait / 1000)}s for Uma's test hold`); await sleep(wait); }
    const card = '[data-upd="mail"]', t0 = Date.now();
    await p.fill('#rc-upd-mail', S.inbox.new.address); await p.click(`${card} [data-upd-btn]`);
    ok('session 3: update → a code is sent to the new address', await shown(p, `${card} [data-upd-code]`), await text(p, `${card} [data-upd-err]`));
    await p.fill(`${card} [data-upd-code]`, await readCode('new', t0, 'update code')); await p.click(`${card} [data-upd-btn]`);
    ok('session 3: the code from ‹new› → saved', await shown(p, `${card} [data-upd-saved]`), await text(p, `${card} [data-upd-err]`));
    await p.click('[data-to-people]'); await shown(p, '[data-state="people"]');
    r = await rows(p); ok('session 3: after the hold → "The wait is over."', r.length === 1 && r[0].status === 'The wait is over.', JSON.stringify(r));
    if (EXPIRE_SESSION) {
      const left = doorAt + (DOOR_SESSION_MIN + 1) * 60000 - Date.now();
      if (left > 0) { log(`row 1133: keeping the page open ${Math.round(left / 1000)}s, past the ${DOOR_SESSION_MIN}-minute door session`); await sleep(left); }
      await p.click('[data-list] > * [data-p="send"]');
      const err = p.locator('[data-list] [data-p="err"]');
      await err.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
      const said = (await err.isVisible()) ? (await err.innerText()).trim() : '';
      ok('row 1133: Send the 6 digits after the door session ran out → the founder\'s words for NOT_FOUND', said === NOT_FOUND_WORDS && !(await p.locator('[data-state="digits"]').isVisible()), `the page says: ${said || '(nothing)'}`);
      ok('row 1133: never "couldn\'t reach" for a refusal the engine answered', !/couldn.t reach/i.test(said), said);
      ok('row 1133: the door really answered 409 NOT_FOUND', doorLog.some(l => l === 'door door_send_digits → 409 NOT_FOUND'), doorLog.filter(l => /send_digits/.test(l)).join(' | ') || 'no send_digits call seen');
      return;
    }
    const t1 = Date.now(); await p.click('[data-list] > * [data-p="send"]');
    const d = await shown(p, '[data-state="digits"]');
    // the contact here is an email, so "sent to" must be a masked email: an '@' and the mask's dots. Four digits is the
    // sealed token masked as a phone (F-555), which this check once let through (13 Oct 09:30).
    const sentTo = d ? await text(p, '[data-sent-to]') : '';
    ok('session 3: Send the 6 digits → "digits", sent to the masked address', d && MASKED_EMAIL.test(sentTo.trim()), d ? `sent to: ${shape(sentTo)}` : 'no digits state');
    // no digits in either tag is a FAIL with the door's answer beside it, never a crash that loses the proof
    const where = await Promise.any(['new', 'contact'].map(role => readCode(role, t1, 'the digits').then(() => role))).catch(() => 'neither');
    ok('session 3: the digits arrive, at the updated address', where === 'new', `in ‹${where}›`);
  });
  }

  }

  writeFileSync(ONLY_B ? 'proofs/positive-live-908.txt' : ONLY_YES ? 'proofs/positive-live-f257.txt' : 'proofs/positive-live.txt', [`cc-website-02 JOB 2 — the positive paths on ${BASE}, ${new Date().toISOString()}`, ...results,
    `requests by host: ${JSON.stringify(requests)}`, `requests to any other host: ${offHost.length}`, 'the doors answered:', ...doorLog].join('\n') + '\n');
  const waits = results.filter(r => r.startsWith('WAITS') || r.startsWith('SKIPPED')).length;
  console.log(`\n${results.filter(r => r.startsWith('PASS')).length}/${results.length - waits} passed${waits ? ` · ${waits} wait for an emailed code` : ''} · other hosts: ${offHost.length}`);
  if (results.some(r => r.startsWith('FAIL')) || offHost.length) process.exitCode = 1;
} else if (process.argv[2] === 'teardown') {
  // every owner the run signed up, purged through the test door (identity.purge waits out the 10-minute gap itself);
  // the caller reads the rows back and sees 0 — "the door didn't say it failed" is not "deleted" (live-turn skill §5)
  const owners = O.kept(ownersFile);
  if (!owners.length) { console.log('teardown: no owners recorded in STATE'); }
  for (const r of await O.purgeOwners(owners)) log(`purge ${r.tag}: ${r.ok ? 'done' : 'NOT done'} ${r.headline}`);
  // the inboxes are plus-tags of ENGINES' test Gmail inbox: nothing to delete, and the reader archives nothing (266, Q2)
} else { console.error('run | teardown'); process.exit(2); }
