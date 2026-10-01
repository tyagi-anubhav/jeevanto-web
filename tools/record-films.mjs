// Records each of Claude Design's films (website-videos/Player.dc.html) to an H.264 file, dark and light,
// plus its "Ends on" frame as a still. Real-time screencast; the Player scales the 360x700 film to the 720x1400 window (2x); frames re-timed from their own timestamps.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const FFMPEG = process.env.FFMPEG;
const BASE = 'http://127.0.0.1:8731/website-videos/Player.dc.html';
const LEN = { Opening: 10000, Notes: 18500, Reminders: 26500, Prepare: 21000, Find: 12500, Book: 24500, Order: 29500, 'Do this': 21500, Send: 17000, Lookout: 19000, Errands: 38500 };
const only = process.argv.slice(2);
const films = Object.keys(LEN).filter(n => !only.length || only.includes(n));
const OUT = 'public/films', TMP = process.env.TMPDIR_FILMS || '/tmp/jv-films';
mkdirSync(OUT, { recursive: true });
const slug = n => n.toLowerCase().replace(/\s+/g, '');
const b = await chromium.launch({ args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
for (const name of films) for (const theme of ['dark', 'light']) {
  const ctx = await b.newContext({ viewport: { width: 720, height: 1400 }, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?video=${encodeURIComponent(name)}&theme=${theme}&replay=0`, { waitUntil: 'networkidle' });
  // The Player's own prop defaults outrank its URL parameters when it runs as a page (Site v9's initFilm note),
  // so the film and theme are also handed to it as props once it has booted, as the site does.
  await page.waitForFunction(() => window.__dcRootName && window.__dcRootName() && window.__dcSetProps);
  await page.evaluate(([video, theme]) => window.__dcSetProps(window.__dcRootName(), { video, theme, hideStrip: false, still: false, replay: false }), [name, theme]);
  await page.waitForTimeout(800);
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1500);
  const dir = `${TMP}/${slug(name)}-${theme}`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  const frames = []; let t0 = null;
  cdp.on('Page.screencastFrame', async f => {
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    if (t0 !== null && f.metadata.timestamp >= t0) frames.push({ t: f.metadata.timestamp, data: f.data });
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: 720, maxHeight: 1400, everyNthFrame: 1 });
  await page.waitForTimeout(300);
  t0 = await page.evaluate(() => { window.postMessage({ type: 'jeevanto-replay' }, '*'); return Date.now() / 1000; });
  await page.waitForTimeout(LEN[name] + 700);
  await cdp.send('Page.stopScreencast');
  await page.waitForTimeout(200);
  const still = `${OUT}/${slug(name)}-${theme}.jpg`;
  await page.screenshot({ path: still, type: 'jpeg', quality: 88 });
  // concat list with each frame's real duration; the last frame holds to the film's length
  let list = '';
  frames.forEach((f, i) => { const p = `${dir}/${String(i).padStart(5, '0')}.jpg`; writeFileSync(p, Buffer.from(f.data, 'base64'));
    const next = i + 1 < frames.length ? frames[i + 1].t : t0 + LEN[name] / 1000 + 0.3; list += `file '${p}'\nduration ${Math.max(0.001, next - f.t).toFixed(4)}\n`; });
  list += `file '${dir}/${String(frames.length - 1).padStart(5, '0')}.jpg'\n`;
  writeFileSync(`${dir}/list.txt`, list);
  const mp4 = `${OUT}/${slug(name)}-${theme}.mp4`;
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`, '-vf', 'fps=30,scale=in_range=full:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-movflags', '+faststart', '-an', mp4]);
  const gaps = frames.slice(1).map((f, i) => f.t - frames[i].t); const maxGap = gaps.length ? Math.max(...gaps) : 0;
  console.log(`${name} ${theme}: ${frames.length} frames over ${(frames.at(-1).t - frames[0].t).toFixed(1)}s, first at +${((frames[0].t - t0) * 1000).toFixed(0)}ms, longest gap ${(maxGap * 1000).toFixed(0)}ms`);
  await ctx.close();
}
await b.close();
