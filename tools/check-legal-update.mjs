// cc-website-03 proof: the privacy policy's eight edits (decisions 215/216) and Terms 6.3, read back in real browsers.
//
//   node tools/check-legal-update.mjs read <base> <label>   saves the text of /privacy-policy and /terms as each
//        browser shows it (Chromium and WebKit, phone 390 and laptop 1440) to proofs/legal/<label>-…txt, and checks it
//   node tools/check-legal-update.mjs links <base>          every link on both pages answers (outside ones too)
//
// "after": every edit present word for word, every replaced line gone. The diff before → after is taken with diff -u
// on the saved text, so "nothing else changed" is read off the page, not assumed.
import { chromium, webkit } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const [mode, BASE0, label = 'after'] = process.argv.slice(2);
const BASE = (BASE0 || 'https://jeevanto.com').replace(/\/$/, '');
const results = [], ok = (n, c, x = '') => { results.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`); };

// The approved text (legal-privacy-policy-update-215-216-2026-10-05.md), as a browser shows it (bold is not text).
const NOW = {
  policy: [
    'On websites, you stay in charge. Jeevanto signs in with the login you saved, or makes you an account if you say yes, and fills things in. You see it before it\'s sent, and you pay or confirm yourself.',
    'Logins you save for websites, and logins for accounts Jeevanto creates for you on a site with your yes (section 5.2)',
    'So Jeevanto can sign you in to that site when you ask it to do something there (section 5.2). Jeevanto never pays for you: you pay on the site\'s own page. They\'re locked with a key on your own phone',
    'We never act for you without your say-so. Jeevanto signs in with your saved login only for a job you\'ve asked for, and never presses pay, book, confirm or place order: you do.',
    'Jeevanto never sends a text, WhatsApp or email as you. It writes the message and opens it in your own app, and you send it. The only messages that go from inside Jeevanto are messages between two Jeevanto users (in-app), and Jeevanto\'s own messages: your sign-in codes and account notices, and, only when you ask, an invitation to someone you add to your Circle or as your recovery contact.',
    'Using websites for you. When you ask Jeevanto to book, order or get something done on a website, it works on that site in a browser while you stay in charge:',
    'it signs in with the login you saved for that site;',
    'if you don\'t have an account on that site, and you say yes, Jeevanto creates one for you with the details the site needs, and saves its login in your Vault. You can see or change that login there at any time;',
    'with no saved login and no new account, you sign in yourself;',
    'a code sent to your phone by text, you enter yourself;',
    'a code sent to an email account you\'ve connected is read and entered by Jeevanto, only if it comes from that site\'s own address, arrived within the last 10 minutes, and is used once. The code is never kept or logged;',
    'it fills in the form or the cart, and shows you what it filled before anything is sent;',
    'you pay, book or confirm yourself, on the site\'s own page;',
    'a bank account number is always yours to type.',
    'Runs the web browser Jeevanto uses on a site for you, when that job doesn\'t run on your phone. It sees only that job\'s pages',
    'when you ask us to: for example, when Jeevanto signs in or books on a site for you, it gives that site your saved login, or the details the booking needs, and only that site;',
    'Finds the facts that matter in mail you receive, such as a booking, a date, a bill or an offer, so it can remind you, prepare you and find things for you. When you\'ve asked Jeevanto to sign in to a site, it also reads the sign-in code that site emails you, and uses it once (section 5.2). It keeps the facts, each pointing to the email it came from. It doesn\'t keep the mail itself, and it never keeps a code.',
    'Read the events in your Google Calendar',
    'Knows your appointments and plans, so it can remind you and prepare you. It never changes your calendar.',
    'WHAT CHANGED · 5 OCTOBER 2026',
  ],
  terms: ['When you book, order or pay on another company\'s website through Jeevanto, your contract is with that company, not with us. Their prices, terms, cancellation rules and refunds apply.'],
};
const GONE = {
  policy: ['Passwords and payment options you save for sites', 'We never act as you, or claim to be you.', 'Send email from your Gmail', 'when Jeevanto books on a site, it gives that site the details the booking needs, after you say go', 'an offer or a code a site sends you', 'Read your Google Calendar'],
  terms: ['When Jeevanto books, orders or pays on another company\'s website'],
};
const PAGES = { policy: '/privacy-policy', terms: '/terms' };
const norm = t => t.replace(/[‘’]/g, "'").replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();

if (mode === 'read') {
  mkdirSync('proofs/legal', { recursive: true });
  for (const [en, E] of [['chromium', chromium], ['webkit', webkit]]) {
    const b = await E.launch();
    for (const [dev, vp] of [['phone', { width: 390, height: 844 }], ['laptop', { width: 1440, height: 900 }]]) {
      const p = await (await b.newContext({ viewport: vp })).newPage();
      for (const [k, path] of Object.entries(PAGES)) {
        await p.goto(BASE + path, { waitUntil: 'load' });
        const text = norm(await p.locator('article').innerText());
        writeFileSync(`proofs/legal/${label}-${k}-${en}-${dev}.txt`, text + '\n');
        if (label === 'after') {
          const flat = text.replace(/\n/g, ' ');
          const missing = NOW[k].filter(s => !flat.includes(norm(s)) && !text.includes(norm(s)));
          ok(`${en} ${dev} ${path}: every edit present word for word (${NOW[k].length})`, !missing.length, missing.map(s => s.slice(0, 60)).join(' | '));
          const left = GONE[k].filter(s => flat.includes(norm(s)));
          ok(`${en} ${dev} ${path}: every replaced line gone (${GONE[k].length})`, !left.length, left.join(' | '));
          if (k === 'policy') {
            const toc = await p.locator('nav[aria-label="Contents"] a').allInnerTexts();
            ok(`${en} ${dev} ${path}: Contents still 1–19, section 5 holds 5.1 and 5.2`, toc.length === 19 && /5\.1[\s\S]*5\.2/.test(await p.locator('#section-5').innerText()), `${toc.length} entries`);
          }
        }
      }
    }
    await b.close();
  }
} else if (mode === 'links') {
  const b = await chromium.launch(); const p = await b.newPage(); const seen = new Map();
  for (const path of Object.values(PAGES)) {
    await p.goto(BASE + path);
    for (const h of await p.$$eval('a[href]', as => as.map(a => a.href))) if (!seen.has(h)) seen.set(h, path);
  }
  await b.close();
  for (const [h, from] of seen) {
    if (h.startsWith('mailto:')) { ok(`mailto on ${from}`, true); continue; }
    const u = new URL(h);
    if (u.origin === new URL(BASE).origin && u.hash) {   // an anchor on our own page: the id must exist
      const html = await (await fetch(u.origin + u.pathname)).text();
      ok(`${u.pathname}${u.hash}`, html.includes(`id="${u.hash.slice(1)}"`)); continue;
    }
    const r = await fetch(h, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (jeevanto.com link check)' } }).catch(e => ({ status: 'ERR ' + e.message }));
    ok(`${h}`, r.status === 200, `${r.status}${r.url && r.url !== h ? ' at ' + r.url : ''}`);
  }
}
const fails = results.filter(r => r.startsWith('FAIL'));
console.log(results.filter(r => r.startsWith('FAIL') || mode === 'read').join('\n'));
console.log(`${results.length - fails.length}/${results.length} passed`);
if (fails.length) process.exitCode = 1;
