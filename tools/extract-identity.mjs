// Renders Claude Design's JeevantoOrb and IlluminatedWordmark (jeevanto-identity.jsx) once, and saves the
// resulting static markup, so the live site carries the exact identity without React.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { openDesign } from './design-probe.mjs';
const b = await chromium.launch();
const { page } = await openDesign(b, { w: 1440, h: 900, theme: 'dark' });
const jobs = [];
for (const mode of ['dark', 'light']) {
  for (const size of [140, 112, 80]) jobs.push({ kind: 'orb', mode, size });
  jobs.push({ kind: 'wordmark', mode, size: 24 });
}
const out = {};
for (const j of jobs) {
  out[`${j.kind}-${j.mode}-${j.size}`] = await page.evaluate(async (j) => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = ReactDOM.createRoot(host);
    const el = j.kind === 'orb'
      ? React.createElement(window.JeevantoOrb, { size: j.size, mode: j.mode, state: 'present', recipe: 'daystone' })
      : React.createElement(window.IlluminatedWordmark, { fontSize: j.size, fontWeight: 300, mode: j.mode, state: 'listening', recipe: 'daystone' });
    root.render(el);
    await new Promise(r => setTimeout(r, 300));
    const html = host.innerHTML; root.unmount(); host.remove(); return html;
  }, j);
}
writeFileSync('src/identity/identity.json', JSON.stringify(out, null, 1));
console.log(Object.entries(out).map(([k, v]) => k + ' ' + v.length).join('\n'));
await b.close();
