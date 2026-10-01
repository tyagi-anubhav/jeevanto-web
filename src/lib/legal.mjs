// The three legal pages, from Cowork's files word for word (content/legal, copied from
// ClaudeDesign/_briefs/legal-2026-09-29), rendered as Site v9's legalDoc does: title and version line, In short,
// Contents, numbered sections, working cross-links. The grey draft note at the top is left out.
// The only changes to the words are the ones the brief asks for (A1): the provider's name and address come from
// the site's config (decision 207), and the refund example says its prices are samples.
import { readFileSync } from 'node:fs';
import { config } from './config.mjs';

const FILES = { policy: 'jeevanto-privacy-policy.md', terms: 'jeevanto-terms-of-use.md', refunds: 'jeevanto-refunds-and-cancellation.md' };
export const TITLES = { policy: 'Privacy policy', terms: 'Terms of use', refunds: 'Refunds and cancellation' };
export const PATHS = { policy: '/privacy-policy', terms: '/terms', refunds: '/refunds' };
// Fixed section addresses Google is given (brief B1). Every other section is #section-N.
const ANCHORS = { policy: { '14': 'google-user-data' } };

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function values() {
  const c = config, L = c.legal || {};
  return Object.assign({}, L, {
    legal_name: c.legalName, registered_address: c.registeredAddress,
    cin: c.cin || '(To be confirmed)', gstin: c.gstin || '(To be confirmed)',
    support_email: c.supportEmail, grievance_email: c.privacyEmail, security_email: c.securityEmail,
    support_reply_days: String(c.replyDays), free_months: String(c.freeMonths),
    founding_places: Number(c.foundingPlaces).toLocaleString('en-IN'), founding_years: String(c.foundingYears),
    grace_days: String(c.familyGraceDays), backup_days: String(c.backupDays),
  });
}

// A1: keep the design's {{legal_name}} / {{registered_address}} placeholders and its "sample prices" wording.
function prepare(md) {
  return md
    .replace(/Nistula Tech Labs OPC Private Limited/g, '{{legal_name}}')
    .replace(/Sector-66, Gurugram, Haryana - 122102, India/g, '{{registered_address}}')
    .replace('*Example, at the founding prices:*', '*Example, with sample prices (not our prices):*')
    .replace(PRE_REG.terms.from, preRegistration() ? PRE_REG.terms.to : PRE_REG.terms.from)
    .replace(PRE_REG.privacy.from, preRegistration() ? PRE_REG.privacy.to : PRE_REG.privacy.from);
}
// Until the company is registered (decision 207; founder, then Cowork on row 835, 1 Oct): the provider is a person,
// who has no CIN or GSTIN, so Terms 1.1 is only the name and address, and Privacy 1.1 drops "(CIN …)". Both come
// back by themselves once legalName is the company.
const PRE_REG = {
  terms: { from: '{{legal_name}}**, a One Person Company registered in India. Its registered office is at {{registered_address}}. Corporate Identity Number (CIN): {{cin}}. GSTIN: {{gstin}}.', to: '{{legal_name}}**, {{registered_address}}.' },
  privacy: { from: '{{legal_name}}**, {{registered_address}} (CIN {{cin}}).', to: '{{legal_name}}**, {{registered_address}}.' },
};
import { preRegistration as PRE } from './config.mjs';
export const preRegistration = () => PRE;

function runs(str, forceBold) {
  let out = '', b = false, i = false, last = 0, m;
  const re = /\*\*|\[([^\]]+)\]\(([^)]+)\)|\*/g;
  const push = x => { if (!x) return; const w = (b || forceBold) ? 600 : 400; const st = (w === 600 ? 'font-weight:600;' : '') + (i ? 'font-style:italic;' : '');
    out += st ? `<span style="${st}">${esc(x)}</span>` : esc(x); };
  while ((m = re.exec(str))) {
    push(str.slice(last, m.index));
    if (m[0] === '**') b = !b; else if (m[0] === '*') i = !i;
    else if (m[2].startsWith('/')) out += `<a href="${esc(m[2])}" style="color:var(--brass); font-weight:600;">${esc(m[1])}</a>`;
    else out += `<a href="${esc(m[2])}" rel="noopener" target="_blank" style="color:var(--brass); font-weight:600;">${esc(m[1])}</a>`; // 600 always, so a link isn't told apart by colour alone (axe link-in-text-block)
    last = re.lastIndex;
  }
  push(str.slice(last));
  return out;
}

export function legalDoc(key) {
  const V = values();
  const raw = readFileSync(new URL('../../content/legal/' + FILES[key], import.meta.url), 'utf8');
  const md = prepare(raw).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (V[k] ?? m));
  const left = md.match(/\{\{\s*\w+\s*\}\}/g); if (left) throw new Error(key + ': unfilled placeholders ' + left.join(', '));
  const doc = { meta: '', short: [], shortAfter: [], toc: [], secs: [] };
  let cur = null, blk = null;
  md.split('\n').forEach(rawLn => {
    const ln = rawLn.trim();
    if (!ln || ln === '---') { blk = null; return; }
    if (/^# /.test(ln) || /^>/.test(ln)) return;               // the title is the page's; the grey draft note is left out
    if (/^\*\*Version/.test(ln)) { doc.meta = ln.replace(/\*\*/g, ''); return; }
    let h;
    if ((h = ln.match(/^## (.*)$/))) {
      blk = null; const n = h[1].match(/^(\d+)\. (.*)$/);
      if (h[1] === 'In short') cur = { kind: 'short' };
      else if (!n) cur = { kind: 'skip' };                         // "Contents" is rebuilt from the sections
      else { const id = (ANCHORS[key] || {})[n[1]] || 'section-' + n[1]; cur = { kind: 'sec', n: n[1], title: n[2], id, blocks: [] }; doc.secs.push(cur); doc.toc.push({ n: n[1], title: n[2], id }); }
      return;
    }
    if (!cur || cur.kind === 'skip') return;
    if (cur.kind === 'short') { if (/^- /.test(ln)) doc.short.push(runs(ln.slice(2))); else doc.shortAfter.push(runs(ln)); return; }
    if (/^- /.test(ln)) {
      if (!blk || !blk.isList) { const prev = cur.blocks[cur.blocks.length - 1]; blk = { isList: true, items: [], indent: prev && prev.num ? true : false }; cur.blocks.push(blk); }
      blk.items.push(runs(ln.slice(2))); return;
    }
    if (/^\|/.test(ln)) {
      if (/^\|[\s|:-]+\|$/.test(ln)) return;
      const cells = ln.replace(/^\||\|$/g, '').split('|').map(x => x.trim());
      if (!blk || !blk.isTable) { blk = { isTable: true, head: cells.map(x => x.toUpperCase()), rows: [], cols: cells.length === 3 ? 'minmax(0,1fr) minmax(0,1.4fr) minmax(0,1.4fr)' : `repeat(${cells.length}, minmax(0,1fr))` }; cur.blocks.push(blk); return; }
      blk.rows.push({ wide: cells.map(c => runs(c)), phone: cells.map((c, ci) => runs(c, ci === 0)) }); return;
    }
    blk = null; const nm = ln.match(/^(\d+\.\d+[A-Z]?)\s+(.*)$/);
    cur.blocks.push({ isP: true, num: nm ? nm[1] : '', html: runs(nm ? nm[2] : ln) });
  });
  return doc;
}
