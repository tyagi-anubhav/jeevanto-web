# jeevanto.com

The public website for Jeevanto. A static site (Astro), built by GitHub Actions and served by GitHub Pages at
**https://jeevanto.com** (`www.jeevanto.com` redirects to it).

Built from Claude Design's approved handback (`Site v9`, 1 Oct 2026) with Cowork's review fixes
(`design-brief-website-review-fixes-2026-10-01.md`), the legal text from `_briefs/legal-2026-09-29/`, and the
founder's decisions up to 207. **No secrets live here, ever.** No cookies, no analytics, no outside scripts or
fonts: every file the site loads comes from jeevanto.com, and the Content-Security-Policy says so to the browser.

## Where things are

| Path | What it is |
|---|---|
| `site-config.json` | Every value the site reads from the ops console (OPS-CONSOLE-PLACEHOLDERS.md), with `siteMode` and decision 207's `legalName`. The fallback once ENGINES' public read-only door exists (set the repository variable `SITE_CONFIG_URL`). |
| `src/layouts/Shell.astro` | Template 1, the page shell: header, footer, theme switch, CSP. |
| `src/components/` | The design blocks (TEMPLATES.md): eyebrow, row list, film, Replay, identity (orb and wordmark), the paperwork. |
| `src/pages/` | One file per fixed address. |
| `content/legal/` | Cowork's three legal files, word for word. `src/lib/legal.mjs` renders them. |
| `src/identity/identity.json` | The Daystone orb and the wordmark, rendered once from `jeevanto-identity.jsx` (no React on the live site). |
| `public/films/` | The eleven films, recorded dark and light from Claude Design's player, with their stills and first frames. |
| `public/fonts/` | Newsreader, Source Sans 3 and Cormorant Garamond Light, self-hosted (SIL Open Font Licence, `licences/`). |
| `tools/` | How the site's parts were made, and the proofs (below). |
| `docs/website-later.md` | What comes back when coming-soon mode ends, and what each part needs from ENGINES. |

## Fixed addresses (never change once live)

Open now: `/` · `/what-it-does` · `/circle` · `/kin-mode` · `/our-promise` · `/help` · `/privacy-policy` (Google
data: `/privacy-policy#google-user-data`) · `/terms` · `/refunds` · `/check` · `/recover` · `/invited` (the last
three are holding pages until ENGINES' doors are built in).
Come back when coming-soon mode ends: `/plans` · `/sign-in` · `/create-account` · `/account` · `/delete-account` · `/get-the-app`.

## Build and check

```sh
npm ci
npx astro build                    # → dist/
node tools/serve.mjs               # serves dist/ the way Pages does, on :4321
node tools/check-site.mjs http://127.0.0.1:4321      # links, outside requests, cookies, accessibility
node tools/check-behaviour.mjs http://127.0.0.1:4321 # films, theme, menus, in Chromium and WebKit
python3 tools/check-legal-text.py  # the legal pages against Cowork's files (run compare-text first)
```

The design-side tools (`design-probe.mjs`, `compare-shots.mjs`, `compare-text.mjs`, `extract-identity.mjs`,
`record-films.mjs`, `capture-stills.mjs`) need Claude Design's handback folder served on `127.0.0.1:8731`.
