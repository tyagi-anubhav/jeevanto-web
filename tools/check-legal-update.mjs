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
    'WHAT CHANGED · ', // dated the day 1.3 comes into force (the console's in_force_date)
    // policy 1.1: decisions 231 (the sign-in record) and 233 (visit counts), Cowork's words of 6 Oct 15:30
    'This website counts visits without cookies and without knowing who you are. No ads, and no tracking. It keeps one sign-in record in your browser, only if you sign in.',
    'The website: counting visits, and signing in',
    'jeevanto.com counts visits without cookies and without knowing who you are: the pages read, where people leave, how they arrived, the kind of device and the country, through Cloudflare Web Analytics. No ads, and no tracking: nothing records what you do on a page. A visitor who just reads the site gets no cookie. This website keeps one sign-in record in your browser, only if you sign in. It goes when you sign out. Because it\'s needed for the sign-in you asked for, and nothing else, we don\'t show a cookie banner.',
    'Counts visits to this website, without cookies (section 15)',
    'How the website remembers that you’re signed in: one sign-in record in your browser, only if you sign in (section 15).',
    'How we count visits to this website: without cookies and without knowing who you are (sections 9 and 15).',
    // policy 1.2: decisions 247 (10.5, N = 7 days from ENGINES) and 241/248 (12.1), Cowork's go 9 Oct 14:30
    'When you sign in, our hosting provider, Supabase, records your email address and the time in its sign-in records, as part of running the service, and keeps them for 7 days before deleting them.',
    'Your own name and email address are the exception: we keep them readable, because we need them to sign you in, write to you and run your plan. The names of the people you add or invite are sealed like everything else.',
    'How long our hosting provider keeps sign-in records (section 10.5).',
    'Your own name and email address stay readable; everything else is sealed (section 12.1).',
    // policy 1.3: decisions 255–257 (deletion at once, after a copy) and 256 (problem reports), Cowork's check 10 Oct 14:25
    'Delete your account any time, in the app or by writing to us. You\'re offered a copy of everything first; then everything is deleted straight away.',
    'What you write to support, in a problem report from the app, or to the Grievance Officer',
    'you\'re first offered a copy of everything to keep. Then everything is deleted, straight away.',
    'and no one restores from them.',
    'A problem report you send us from the app is read by our team, to help you. We delete it 12 months after we close it, or when you delete your account, whichever comes first.',
    'Deleting your account: you\'re offered a copy first, then everything is deleted straight away, and no one restores from backups (In short, section 10.2).',
    'A problem report you send from the app is read by our team, and how long we keep it (sections 3 and 12.1).',
    // decisions 210 and 213 (2 Oct), the founder's words
    'Deliver notifications to your phone; sign-in, if you choose it; turn what you say to Jeevanto into text',
    'Speaking to Jeevanto. When you talk to Jeevanto, your phone\'s own speech service turns your words into text: Apple on iPhone, Google on Android. Depending on your phone, this happens on the phone itself or on Apple\'s or Google\'s servers. Jeevanto receives only the text, never the recording. When Jeevanto reads a reply aloud, it uses your phone\'s own voice.',
    'Speaking to Jeevanto: your phone\'s own speech service turns what you say into text, and reads replies aloud in your phone\'s own voice (section 9).',
    'Version 1.3 · In force from',
  ],
  terms: ['When you book, order or pay on another company\'s website through Jeevanto, your contract is with that company, not with us. Their prices, terms, cancellation rules and refunds apply.', 'or without the app by writing to us from the email address on your account. We send a link to that address to confirm it\'s you.', 'Version 1.3 · In force from'],
};
const GONE = {
  policy: ['It sets one cookie, only if you sign in', 'The website and cookies', 'no trackers and no ads', 'one cookie, just to keep you signed in', 'WHAT CHANGED · 5 OCTOBER 2026', 'WHAT CHANGED · 6 OCTOBER 2026', 'Version 1.0', 'Version 1.1', 'Version 1.2', 'launch date', 'everything goes, straight away, and copies in our backups are gone', 'in the app or on our website. Everything goes', 'Passwords and payment options you save for sites', 'We never act as you, or claim to be you.', 'Send email from your Gmail', 'when Jeevanto books on a site, it gives that site the details the booking needs, after you say go', 'an offer or a code a site sends you', 'Read your Google Calendar'],
  terms: ['When Jeevanto books, orders or pays on another company\'s website', 'Version 1.0', 'Version 1.1', 'Version 1.2', 'with your email or mobile number and a code we send you'],
};
const PAGES = { policy: '/privacy-policy', terms: '/terms' };
const norm = t => t.replace(/[‘’]/g, "'").replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();

if (mode === 'read') {
  mkdirSync('proofs/legal', { recursive: true });
  for (const [en, E] of [['chromium', chromium], ['webkit', webkit]]) {
    const b = await E.launch();
    for (const [dev, vp] of [['phone', { width: 390, height: 844 }], ['laptop', { width: 1440, height: 900 }]]) {
      const p = await (await b.newContext({ viewport: vp, locale: 'en-IN' })).newPage(); // the built default (decision 246)
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
