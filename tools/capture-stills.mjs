// Each film's still, as the design shows it with reduced motion (Player still=1: the "Ends on" frame; Opening
// adds its still-only line), and each film's first frame, shown before it plays. Run after record-films.mjs.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
const BASE = 'http://127.0.0.1:8731/website-videos/Player.dc.html';
const FILMS = ['Opening', 'Notes', 'Reminders', 'Prepare', 'Find', 'Book', 'Order', 'Do this', 'Send', 'Lookout', 'Errands'];
const slug = n => n.toLowerCase().replace(/\s+/g, '');
const b = await chromium.launch();
for (const name of FILMS) for (const theme of ['dark', 'light']) {
  const ctx = await b.newContext({ viewport: { width: 720, height: 1400 }, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?video=${encodeURIComponent(name)}&theme=${theme}&still=1&replay=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__dcRootName && window.__dcRootName() && window.__dcSetProps);
  await page.evaluate(([video, theme]) => window.__dcSetProps(window.__dcRootName(), { video, theme, hideStrip: false, still: true, replay: false }), [name, theme]);
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1500);
  await page.screenshot({ path: `public/films/${slug(name)}-${theme}.jpg`, type: 'jpeg', quality: 88 });
  execFileSync(process.env.FFMPEG, ['-y', '-loglevel', 'error', '-i', `public/films/${slug(name)}-${theme}.mp4`, '-frames:v', '1', '-q:v', '3', `public/films/${slug(name)}-${theme}-first.jpg`]);
  console.log(name, theme); await ctx.close();
}
await b.close();
