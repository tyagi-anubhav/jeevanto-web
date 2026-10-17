// Test owners made THE REAL WAY (Cowork 17 Oct 17:15, (b); the live-turn skill §3; decisions 264, 266, 281): each one
// signs up through the app's own email-code door with a fresh plus-tag of the test Gmail, its code read from Gmail and
// typed in (TESTS' one sign-up helper, tests/readiness/lib/identity.mjs, imported from a checkout of the tests branch,
// never copied). Then only the app's own calls, under the owner's own session:
//   · its name, as the app's name step sets it (src/lib/onboarding/pendingName.ts: auth updateUser + PATCH account);
//   · Uma asks a recovery contact (edge recovery-contact, action ask), as Settings · Recovery does;
//   · Asha issues a kin invite code (edge kin /code), as the app's invite does.
// Its alerts go to its own sign-up address (verified by the sign-up itself): no channel is written by hand.
// No admin API, no SQL writes. Purged through the test door (identity.purge), read back by the caller.
//
//   TESTS_REPO=<a checkout of the app repo's `tests` branch> — where identity.mjs lives.
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

let I = null, P = null;
async function lib() {
  if (I) return I;
  const repo = process.env.TESTS_REPO;
  if (!repo || !existsSync(join(repo, 'tests/readiness/lib/identity.mjs'))) throw new Error('owners: TESTS_REPO must be a checkout of the tests branch (tests/readiness/lib/identity.mjs)');
  I = await import(join(repo, 'tests/readiness/lib/identity.mjs'));
  P = await import(join(repo, 'tests/readiness/lib/paths.mjs'));   // its own target: live only with JV_TARGET=live, logged
  return I;
}

const name = async (A, display) => {
  const { api } = await lib();
  // the app's two calls (pendingName.ts): the auth record's name, then the account's
  const base = P.envKey('SUPABASE_URL'), anon = P.publicKey();
  const u = await fetch(`${base}/auth/v1/user`, { method: 'PUT', headers: { apikey: anon, Authorization: 'Bearer ' + A.jwt, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { display_name: display } }) });
  const p = await api(A.jwt, 'account', { method: 'PATCH', body: { display_name: display } });
  return { auth: u.status, account: p.status };
};

/** Uma (an owner) signs up and asks `contact` to be her recovery contact. Returns { A, asked, status }. */
export async function ownerWhoAsks(tag, contact, display = 'Uma Website') {
  const { signUpTheAppsWay, api } = await lib();
  const A = await signUpTheAppsWay({ tag });
  const n = await name(A, display);
  const ask = await api(A.jwt, 'recovery-contact', { method: 'POST', body: { action: 'ask', channel_type: 'email', destination: contact, label: 'Ravi' } });
  const id = (ask.j?.data ?? ask.j)?.recovery_contact_id ?? null;
  return { A, named: n, asked: ask.status === 200 && !!id, status: ask.status };
}

/** Asha (an owner) signs up and issues a kin invite code. Returns { A, code, status }. */
export async function ownerWhoInvites(tag, display = 'Asha Website') {
  const { signUpTheAppsWay, api } = await lib();
  const A = await signUpTheAppsWay({ tag });
  const n = await name(A, display);
  const r = await api(A.jwt, 'kin', { method: 'POST', path: '/code', body: { kind: 'kin', invitee_name: 'Ravi', relationship: 'child', direction: 'principal_invites', grants: [] } });
  return { A, named: n, code: r.j?.data?.code ?? null, status: r.status };
}

/** A person who signs up the app's way and does nothing else (no name: as a provider with no name hands one back). */
export async function signUpPerson(tag) { const { signUpTheAppsWay } = await lib(); return signUpTheAppsWay({ tag }); }

/** Purge every owner the run made, through the test door (it waits out the 10-minute gap itself). */
export async function purgeOwners(list) {
  const { purge } = await lib();
  const out = [];
  for (const A of list) {
    try { const r = await purge(A); out.push({ tag: A.email?.split('+')[1]?.split('@')[0] ?? '?', ok: r?.ok !== false, headline: r?.verdict?.headline ?? '' }); }
    catch (e) { out.push({ tag: '?', ok: false, headline: String(e.message).slice(0, 120) }); }
  }
  return out;
}

// the run keeps each owner (jwt, ids) in its own STATE file only: never in a proof, never committed
export const keep = (file, list) => writeFileSync(file, JSON.stringify(list, null, 1));
export const kept = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []);
