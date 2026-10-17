// DMARC, sender by sender (Cowork 12 Oct 19:55; row 1157): one REAL Jeevanto email, read for its authentication.
//
//   STATE=<dir outside both repos> APP=<app checkout> TESTS_REPO=<tests-branch checkout> LIVE=1 node tools/check-mail-auth.mjs run
//   STATE=<same dir> APP=<same> TESTS_REPO=<same> LIVE=1 node tools/check-mail-auth.mjs teardown
// The owner signs up with a Gmail plus-tag, which only LIVE marks as a test identity, so this runs on live (LIVE=1).
//
// One test owner signs up the app's way (Cowork 17 Oct 17:15 (b): tools/owners.mjs → TESTS' identity.mjs; an emailed
// code typed in) and asks a fresh plus-tag of the test Gmail inbox to be a recovery contact, so Jeevanto sends a real
// ask email through whichever provider its dispatch picks (since 17 Oct 15:02, ZeptoMail first on live too). ENGINES' narrow reader (readAuthFromGmail: our sender, that one tag, headers only, never the body)
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
if (!LIVE) { console.error('the owner signs up with a Gmail plus-tag, which only live marks as a test identity: run with LIVE=1'); process.exit(2); }
process.env.JV_TARGET = 'live';
const O = await import('./owners.mjs');
const ownersFile = join(STATE, 'owners.json');
const G = await import(join(APP, 'scripts/verify/engines-kit/gmail-reader.mjs'));

if (process.argv[2] === 'run') {
  const base = await G.inboxAddress(), [user, domain] = base.split('@');
  const tag = () => `${user}+w25web${randomBytes(3).toString('hex')}@${domain}`;
  S.contact = tag(); S.alert = tag(); S.target = LIVE ? 'live' : 'staging'; save();
  S.at = Date.now(); save();
  const u = await O.ownerWhoAsks('w25webmail', S.contact);
  O.keep(ownersFile, [u.A]);
  console.log(`target ${S.target} · owner signed up the app's way (${u.A.steps.filter(x => x.ok).length}/${u.A.steps.length}) · ask → ${u.status}`);
  if (!u.asked) { console.log('the ask was refused: no email to read'); process.exitCode = 1; }
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
  for (const r of await O.purgeOwners(O.kept(ownersFile))) console.log(`purge ${r.tag}: ${r.ok ? 'done' : 'NOT done'} ${r.headline}`);
} else { console.error('run | teardown'); process.exit(2); }
