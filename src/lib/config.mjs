// The site's values: site-config.json, overlaid at build time by ENGINES' public read-only door when one is
// configured (SITE_CONFIG_URL). The file stays the fallback: if the door is unset or can't be reached, the build
// uses the file and says so in the build log. Nothing here is a secret.
import file from '../../site-config.json';

async function fromDoor() {
  const url = process.env.SITE_CONFIG_URL;
  if (!url) return { values: {}, source: 'site-config.json (no door configured)' };
  try {
    const headers = process.env.SITE_CONFIG_ANON_KEY ? { apikey: process.env.SITE_CONFIG_ANON_KEY, Authorization: 'Bearer ' + process.env.SITE_CONFIG_ANON_KEY } : {};
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const values = await r.json();
    return { values: values && typeof values === 'object' ? values : {}, source: 'door ' + url };
  } catch (e) {
    console.warn('[site-config] door unreachable (' + e.message + '); using site-config.json');
    return { values: {}, source: 'site-config.json (door unreachable: ' + e.message + ')' };
  }
}

const door = await fromDoor();
const set = v => v !== undefined && v !== null && v !== '';
export const config = Object.fromEntries(Object.entries(file).filter(([k]) => !k.startsWith('_')));
for (const [k, v] of Object.entries(door.values)) if (set(v)) config[k] = v;
config.legal = Object.assign({}, file.legal, door.values.legal || {});
export const configSource = door.source;
console.log('[site-config] ' + configSource + ' · siteMode=' + config.siteMode + ' · legalName=' + config.legalName);

export const soon = config.siteMode === 'coming soon';
export const full = !soon;
export const legalLine = [config.legalName, config.registeredAddress].filter(Boolean).join(' · ');
export const regLine = 'CIN ' + (config.cin || '(To be confirmed)') + ' · GSTIN ' + (config.gstin || '(To be confirmed)');
