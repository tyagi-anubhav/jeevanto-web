# What comes back when coming-soon mode ends

jeevanto.com went live on 1 Oct 2026 in **coming-soon mode** (`siteMode: "coming soon"` in `site-config.json`).
Everything below is drawn and locked in Claude Design's Site v9 (with Cowork's review fixes, brief of 1 Oct), but is
**not built yet** on the live site. Each part says what the website needs from ENGINES before it can be built
honestly, with no sample data on the live path. Addresses are fixed: they never change once live.

Already built (cc-website-01 JOB 2): /check, /recover, /recover/answer and /invited, on ENGINES' doors.
Not listed below.

Ground rules that hold for all of it:
- the site keeps **no key beyond the public anon key**, and calls only ENGINES' named doors from the browser;
- **one cookie, only when signed in** (the promise on every page and in Privacy 15), and none before;
- every figure, date and switch comes from the ops console door or the signed-in account, never from the page;
- the Content-Security-Policy's `connect-src` gains exactly the engine's own address (our own domain once the
  server moves to it, per the wave-23 Mumbai/own-address plan), and nothing else; Razorpay's pages are reached
  by leaving the site, not by loading its script here, unless Cowork rules otherwise.

## 1. Plans (`/plans`)
The three tiles (Family, Plus, Express), the seat stepper, "The plans side by side", "Who it can work for", the three
"See everything in…" cards, the region line and the founding lines.
**Needs from ENGINES:**
- the public read-only ops-console door (wave 23, JOB 2.3) returning, per region: every price point
  (Plus monthly and yearly, founding monthly and yearly, Family per seat, Family founding, extra kin seat),
  `taxMode`, `pricesConfirmed`, `russiaPlans`, `familyPriceSteps`, `familySeatMax`, `kinSeatPrice`, the allowances
  (`allowFam*`, `allowPlus*`, `allowExp*`), `founding`, `foundingLeft`, `foundingThanks`, the `foundingLines` list;
- **the visitor's region**: GitHub Pages can't read the connection's country. Either a tiny edge that returns
  only the country code from the request (no logging, nothing stored), or the plans page reads it at the moment
  of paying. ENGINES and Cowork to choose; the page must say "Prices for <country>…" truthfully.

## 2. Before you pay, and the result pages (`/plans/pay` → Razorpay → `/welcome`)
Before you pay (summary table, ⓘ sums, step marker), Welcome back / Not paid / every plan-change result
(decision 205's 29 rows: paid, set up only, failed, switch, modify, undo).
**Needs from ENGINES:**
- a door that **prices a change** for the signed-in account (new plan, seats, kin seats, cycle) and returns the
  exact rows the page shows: paid today, part-month, from the 1st, refund or credit, with the sums behind each ⓘ;
- a door that **starts the Razorpay subscription or one-off charge** and returns where to send the visitor;
- a door the result page reads on return, with the **outcome as recorded by the webhook** (never the browser's
  word): confirmed, set up only, not completed, failed;
- receipt versus confirmation (brief A7): the outcome must say whether money moved.

## 3. Your account (`/account`), Modify plan (`/account/modify`), Cancel
The plan table, invoices (with GSTIN), founding line, modify seats, cancel monthly and yearly (refund maths, 172),
"Changed your mind? Keep Plus", pending change and Undo.
**Needs from ENGINES:**
- the signed-in account's plan, seats, kin seats, next payment (always the 1st), paid-to date, founding status,
  trial state and dates, paying method, invoices (PDFs carrying the GSTIN);
- doors to **modify**, **cancel** (with the refund it will make, before confirming), **undo a cancel** and
  **undo a pending change**, each idempotent and recorded.

## 4. Sign in and create your account (`/sign-in`, `/create-account`, `/get-the-app`, the code page `/code`)
Email-or-mobile field (adaptive), the code page, Continue with Google / Apple / Microsoft (Google's words in
Roboto Medium 14px, brief B3: the Roboto font is to be self-hosted too), "By continuing, you agree to our Terms
of use and Privacy policy" (decision 204), Get the app for visitors not signed in.
**Needs from ENGINES:**
- the website's sign-in through the same auth as the app (email/mobile code, and the three providers), returning
  a session the site keeps in **one first-party cookie** (HttpOnly, Secure, SameSite=Lax), set by our own domain;
- **OAuth callbacks on our own address**, not `…supabase.co` (Google's consent screen shows it; wave 23 JOB 3);
- recording which version of the Terms and Privacy policy was agreed to, and when (decision 204);
- texting switched on only where DLT approval allows (decision 183/184); until then the field is email only.

## 5. Delete your account (`/delete-account`)
Ask, the code, confirm, done — with the money lines by plan (205.7) and the "what we keep" line.
**Needs from ENGINES:**
- a door that sends the code to the account's email or mobile, and one that deletes on the code, **cancelling the
  website plan on the spot** (wave 23 item 7), with the monthly/yearly money rule, and returns what happened.
- brief A5: "Want a copy first? Take one in the app…" stays off until the app's Backup & export screen exists.

## 6. The waitlist form ("Tell me when Jeevanto is live")
Today the card says "Want to hear when we're live? Write to help@jeevanto.com." and collects nothing.
**Needs from ENGINES (wave 23, JOB 2.2), all three before the form goes on the page:**
- the door: name, email, optional mobile; rate-limited by source; the same neutral answer every time;
- the retention row: kept until we've told them, or until they ask, then deleted;
- the operator list in the console, and the send-once "we're live" email.
Then the card gets its fields, "Tell me", and brief C's line: "We'll use this only to tell you when Jeevanto is
ready, then delete it. Privacy policy."

## 7. Regions and their prices
Seven regions (₹, $, £, €, AED, S$, A$) plus Russia (Express only by default), each with its own prices — not
converted from India's — and its own `taxMode`.
**Needs from ENGINES:** one column per region for every price point in the ops console (OPS-CONSOLE-PLACEHOLDERS.md),
returned by the public door; `pricesConfirmed` per region; and the country lookup in item 1.
Until a price is confirmed the page shows the region's sign + "TBC". In coming-soon mode no price line shows at all.

## 8. Also waiting, smaller
- **Store badges** on the front door and Invited: shown only once `appStoreUrl` and `playStoreUrl` are set.
- **Founding counter** ("312 of 1,000 founding places left."): needs `foundingLeft` from the door, live.
- **Help's plan questions** ("Which plan is right for me?", "What does Family cost?") and the two whose answers
  are pages not open yet ("How do I cancel?", "Can I delete my account without the app?") come back with those pages.
- The **Sign in** door in the header, the **Plans** item in the menu, the **Plans and account** footer column with
  "Delete your account", and the "Find the right plan for your Circle" links on Circle and Kin mode.

## Switching coming-soon mode off
`siteMode: "full"` today only brings back the links, menu items and Help questions that point at the pages above
(header Sign in, Plans in the menu, the footer's Plans and account column, the plan questions). **The pages
themselves aren't built yet**, so switching it now would show links to 404s. Don't switch it until items 1–5 are
built and proved on live by the Definition of Done.
