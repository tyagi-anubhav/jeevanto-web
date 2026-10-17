// DMARC, sender by sender (Cowork 12 Oct 19:55; row 1157): one REAL Jeevanto email, read for its authentication.
//
//   STATE=<dir outside both repos> APP=<app checkout> [LIVE=1] node tools/check-mail-auth.mjs run
//   STATE=<same dir> APP=<same> [LIVE=1] node tools/check-mail-auth.mjs teardown
//
// ENGINES' fixtures make one test owner who asks a fresh plus-tag of the test Gmail inbox to be a recovery contact,
// so Jeevanto sends a real ask email through whichever provider its dispatch picks (staging: ZeptoMail first; live:
// Resend first). ENGINES' narrow reader (readAuthFromGmail: our sender, that one tag, headers only, never the body)
// then reports SPF, DKIM, DMARC, the signing domains and where Gmail filed it. Nothing printed names an address.
// Default target is STAGING; LIVE=1 is a live use (fixtures JV_TARGET=live, logged by ENGINES' loader).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const { STATE, APP } = process.env, LIVE = process.env.LIVE === '1';
if (!STATE || !APP) { console.error('STATE=<dir> APP=<app checkout> [LIVE=1] node tools/check-mail-auth.mjs run|teardown'); process.exit(2); }
mkdirSync(STATE, { recursive: true });
const sfile = join(STATE, 'state.json'), S = existsSync(sfile) ? JSON.parse(readFileSync(sfile, 'utf8')) : {};
const save = () => writeFileSync(sfile, JSON.stringify(S, null, 1));
const SENDER = 'notifications@jeevanto.com';
const env = { ...process.env, W11C_SCRATCH: join(STATE, 'fixtures.json'), JEEVANTO_REPO: process.env.JEEVANTO_REPO || APP, ...(LIVE ? { JV_TARGET: 'live' } : {}) };
const G = await import(join(APP, 'scripts/verify/engines-kit/gmail-reader.mjs'));

if (process.argv[2] === 'run') {
  const base = await G.inboxAddress(), [user, domain] = base.split('@');
  const tag = () => `${user}+w25web${randomBytes(3).toString('hex')}@${domain}`;
  S.contact = tag(); S.alert = tag(); S.target = LIVE ? 'live' : 'staging'; save();
  S.at = Date.now(); save();
  const out = execFileSync('node', ['scripts/verify/wave25/website-fixtures.mjs', 'make', '--contact', S.contact, '--owner-alert', S.alert], { cwd: APP, env, encoding: 'utf8' });
  const made = out.split('\n').filter(l => /F1 ·/.test(l)).join(' ').replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '<addr>').slice(0, 200);
  console.log(`target ${S.target} · made: ${made}`);
  try {
    const a = await G.readAuthFromGmail({ to: S.contact, sender: SENDER, since: new Date(S.at - 5000), timeoutMs: 900000 });
    const r = { arrived_after_s: Math.round((Date.now() - S.at) / 1000), spf: a.spf, dkim: a.dkim, dmarc: a.dmarc, header_from_domain: a.header_from_domain, signatures: (a.signatures || []).map(x => `${x.d} (${x.s})`), where: a.where };
    S.result = r; save();
    console.log(JSON.stringify(r));
  } catch (e) {
    S.result = { arrived: false, waited_s: Math.round((Date.now() - S.at) / 1000) }; save();
    console.log(`NOT ARRIVED: ${e.message.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '<addr>')}`);
    process.exitCode = 1;
  }
} else if (process.argv[2] === 'teardown') {
  const out = execFileSync('node', ['scripts/verify/wave25/website-fixtures.mjs', 'teardown'], { cwd: APP, env, encoding: 'utf8' });
  console.log(out.split('\n').filter(l => /purge|gone|left|✅|❌/.test(l)).join(' | ').replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '<addr>').slice(0, 300));
} else { console.error('run | teardown'); process.exit(2); }
