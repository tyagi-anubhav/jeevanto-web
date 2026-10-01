// The site's values. At build time the site reads ENGINES' public read-only settings door
// (POST /rest/v1/rpc/site_settings, cc-wave-23-to-website-the-doors-2026-10-01.md §1); site-config.json is the
// fallback, and fills any value the door leaves null. If the door can't be reached the build uses the file and says
// so in the build log. Nothing here is a secret. Set SITE_CONFIG_DOOR=off to build from the file alone.
import file from '../../site-config.json';
import engine from './engine.json';

const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const v = x => (x && typeof x === 'object' && 'value' in x ? x.value : x);

// The door's answer, in the keys the pages read (OPS-CONSOLE-PLACEHOLDERS.md names).
function fromSettings(s) {
  const L = (s.legal && s.legal.numbers) || {}, n = s.numbers || {}, c = s.company || {}, k = s.contact || {}, p = s.plans || {}, f = s.founding || {};
  const legal = {};
  for (const key of ['grievance_ack_hours', 'grievance_resolve_days', 'held_refund_months', 'tax_record_years', 'price_notice_days', 'terms_notice_days', 'shutdown_notice_days', 'refund_start_days', 'bank_refund_days', 'liability_months']) if (v(L[key]) != null) legal[key] = String(v(L[key]));
  if (L.security_log_period && v(L.security_log_period) != null) { const q = Number(v(L.security_log_period)), u = String(L.security_log_period.unit || '').replace(/s$/, ''); legal.security_log_period = (NUM_WORDS[q] || q) + ' ' + u + (q === 1 ? '' : 's'); }
  if (L.liability_floor && v(L.liability_floor) != null) legal.liability_floor = (L.liability_floor.currency === 'INR' ? '₹' : (L.liability_floor.currency || '') + ' ') + Number(v(L.liability_floor)).toLocaleString('en-IN');
  if (n.legal_version) legal.version = String(n.legal_version);
  if (n.in_force_date) legal.in_force_date = String(n.in_force_date);
  return {
    siteMode: s.site_mode === 'coming_soon' ? 'coming soon' : s.site_mode === 'live' ? 'full' : undefined,
    legalName: c.legal_name, registeredAddress: c.registered_address, cin: c.cin, gstin: c.gstin,
    supportEmail: k.support_email, replyDays: k.reply_days != null ? Number(k.reply_days) : undefined, privacyContact: k.privacy_contact, privacyEmail: k.privacy_email, securityEmail: k.security_email,
    freeMonths: p.free_months, familyGraceDays: p.family_grace_days, familySeatMax: p.family_seat_max,
    familyPriceSteps: Array.isArray(p.family_price_steps) ? p.family_price_steps.map((x, i, a) => `${x.seats}${i === a.length - 1 ? '+' : ''}=${x.pct}`).join(', ') : undefined,
    foundingPlaces: f.places, foundingYears: f.years, founding: f.state ? f.state.replace('_', ' ').replace('_', ' ') : undefined, foundingThanks: f.thanks === false ? 'Hide' : f.thanks === true ? 'Show' : undefined,
    foundingLines: s.founding_lines, pricesConfirmed: s.prices_confirmed, russiaPlans: s.russia_plans === 'all_plans' ? 'All plans' : s.russia_plans === 'express_only' ? 'Express only' : undefined,
    appStoreUrl: s.stores && s.stores.app_store_url, playStoreUrl: s.stores && s.stores.play_store_url,
    backupDays: n.backup_days != null ? Number(n.backup_days) : undefined, codeMinutes: n.code_minutes, inviteDays: n.invite_days, recoveryWaitDays: n.recovery_wait_days, recoveryDigits: n.recovery_digits,
    legal,
  };
}

async function fromDoor() {
  if (process.env.SITE_CONFIG_DOOR === 'off') return { values: {}, source: 'site-config.json (door switched off for this build)' };
  try {
    const r = await fetch(engine.url + '/rest/v1/rpc/site_settings', { method: 'POST', headers: { apikey: engine.anonKey, Authorization: 'Bearer ' + engine.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_region: 'IN' }), signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return { values: fromSettings(await r.json()), source: 'settings door ' + engine.url };
  } catch (e) {
    console.warn('[site-config] settings door unreachable (' + e.message + '); using site-config.json');
    return { values: {}, source: 'site-config.json (door unreachable: ' + e.message + ')' };
  }
}

const door = await fromDoor();
const set = x => x !== undefined && x !== null && x !== '';
export const config = Object.fromEntries(Object.entries(file).filter(([k]) => !k.startsWith('_')));
for (const [k, x] of Object.entries(door.values)) if (k !== 'legal' && set(x)) config[k] = x;
config.legal = Object.assign({}, file.legal, Object.fromEntries(Object.entries(door.values.legal || {}).filter(([, x]) => set(x))));
export const configSource = door.source;
export { engine };
console.log('[site-config] ' + configSource + ' · siteMode=' + config.siteMode + ' · legalName=' + config.legalName);

export const soon = config.siteMode === 'coming soon';
export const full = !soon;
export const legalLine = [config.legalName, config.registeredAddress].filter(Boolean).join(' · ');
export const regLine = 'CIN ' + (config.cin || '(To be confirmed)') + ' · GSTIN ' + (config.gstin || '(To be confirmed)');
