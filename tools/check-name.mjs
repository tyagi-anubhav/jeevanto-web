// Decision 245's ratchet: the product's visible name comes from one place (site-config.json → productName, read as
// `productName` from src/lib/config.mjs; {{product_name}} in the legal copies). This builds the site with a stand-in
// name and fails if any "Jeevanto" is still written by hand into what a visitor sees.
//
//   node tools/check-name.mjs        builds into a temp folder (settings door off, so it's offline and repeatable)
//
// Allowed, because they don't change on a rename of the product (decision 245, "leave alone"): the provider's legal name
// from the settings (today "Anubhav Tyagi (Jeevanto)"). Domains and addresses are lower case and never match.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const STAND_IN = 'Zquilto';
const out = mkdtempSync(join(tmpdir(), 'jv-name-'));
execFileSync('npx', ['astro', 'build', '--outDir', out], { env: { ...process.env, JV_PRODUCT_NAME: STAND_IN, SITE_CONFIG_DOOR: 'off' }, stdio: 'pipe' });
const legalName = JSON.parse(readFileSync(new URL('../site-config.json', import.meta.url), 'utf8')).legalName || '';
const files = [], walk = d => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(html|js|txt)$/.test(f) && files.push(p); } };
walk(out);
const left = [], seen = { standIn: 0 };
for (const f of files) {
  let s = readFileSync(f, 'utf8');
  seen.standIn += (s.match(new RegExp(STAND_IN, 'g')) || []).length;
  if (legalName) s = s.split(legalName).join('');
  for (const m of s.matchAll(/.{0,40}\bJeevanto\b.{0,40}/g)) left.push(f.slice(out.length + 1) + ': ' + m[0]);
}
rmSync(out, { recursive: true, force: true });
console.log(`stand-in name shown ${seen.standIn} times across ${files.length} files`);
console.log(left.length ? 'FAIL "Jeevanto" still written by hand:\n' + left.join('\n') : 'PASS no hand-written "Jeevanto" a visitor sees');
if (left.length || !seen.standIn) process.exitCode = 1;
