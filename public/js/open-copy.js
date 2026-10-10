// /open-your-copy (decision 258): opens a locked Jeevanto copy in the browser. Nothing is uploaded; no request is made.
// The format is ENGINES' (supabase/functions/_shared/locked-copy.ts): "JVCOPY1\n", one JSON header line ending "\n"
// (v 1, scrypt N r p dklen, base64 salt and nonce), then AES-256-GCM with the 16-byte tag appended; the additional data
// is the magic plus the header line. The key is scrypt over the code, upper-cased, with everything outside A–Z and 2–9
// removed (exactly 16). scrypt is @noble/hashes 1.4.0, the same build ENGINES uses.
import { scrypt } from '/js/vendor/noble-hashes-1.4.0/scrypt.js';

const root = document.querySelector('[data-open-copy]');
const $ = s => root.querySelector(s), err = $('[data-err]');
const say = m => { err.textContent = m || ''; err.hidden = !m; };
const show = st => { root.querySelectorAll('[data-state]').forEach(el => { el.hidden = el.getAttribute('data-state') !== st; }); const h = root.querySelector(`[data-state="${st}"] h1[tabindex]`); if (h) h.focus(); };
const MAGIC = 'JVCOPY1\n';
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
let saved = null;

export async function openCopy(bytes, code) {
  if (new TextDecoder().decode(bytes.slice(0, 8)) !== MAGIC) throw 'not-ours';
  const nl = bytes.indexOf(10, 8); if (nl < 0) throw 'not-ours';
  let head; try { head = JSON.parse(new TextDecoder().decode(bytes.slice(8, nl))); } catch (e) { throw 'not-ours'; }
  if (head.v !== 1) throw 'newer';
  if (head.kdf !== 'scrypt' || head.cipher !== 'AES-256-GCM') throw 'not-ours';
  const norm = String(code).toUpperCase().replace(/[^A-Z2-9]/g, '');
  if (norm.length !== 16) throw 'code';
  const key = scrypt(new TextEncoder().encode(norm), b64(head.salt), { N: head.N, r: head.r, p: head.p, dkLen: head.dklen });
  const k = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(head.nonce), additionalData: bytes.slice(0, nl + 1) }, k, bytes.slice(nl + 1)));
  } catch (e) { throw 'wrong'; }
}
window.jvOpenCopy = openCopy; // for the page's own check (tools/check-open-copy.mjs)

const WORDS = {
  file: 'Choose the copy you saved: the file ending in .jvcopy.',
  code: 'The code has 16 letters and numbers, like XXXX-XXXX-XXXX-XXXX.',
  wrong: 'That code doesn’t open this copy.',
  'not-ours': 'This isn’t a Jeevanto copy.',
  newer: 'This copy comes from a newer Jeevanto. Open it in the app.',
};
$('[data-state="ask"]').addEventListener('submit', async e => {
  e.preventDefault(); say('');
  const f = document.getElementById('oc-file').files[0], code = document.getElementById('oc-code').value;
  if (!f) { say(WORDS.file); return; }
  if (String(code).toUpperCase().replace(/[^A-Z2-9]/g, '').length !== 16) { say(WORDS.code); return; }
  show('busy');
  await new Promise(r => setTimeout(r, 50)); // let "Opening" paint before the slow key step
  try {
    const out = await openCopy(new Uint8Array(await f.arrayBuffer()), code);
    if (saved) URL.revokeObjectURL(saved);
    saved = URL.createObjectURL(new Blob([out], { type: 'application/zip' }));
    const a = $('[data-save]'); a.href = saved; a.download = f.name.replace(/\.jvcopy$/i, '') + '-opened.zip';
    show('open');
  } catch (x) { show('ask'); say(WORDS[x] || WORDS.wrong); }
});
