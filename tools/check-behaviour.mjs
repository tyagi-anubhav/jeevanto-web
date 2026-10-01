// Drives what the pages do, in Chromium and WebKit: films play once in view and hold their last frame,
// Replay plays again, the theme switch swaps colours and films and is remembered, the phone opens a film full
// screen, Circle's More/Less and Help's questions open and close, and the phone menu opens.
import { chromium, webkit } from 'playwright';
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
for (const [ename, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const b = await engine.launch();
  // Laptop, dark
  let ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' }); let p = await ctx.newPage();
  await p.goto(BASE + '/'); await p.locator('#film-opening').scrollIntoViewIfNeeded(); await p.waitForTimeout(2500);
  let st = await p.evaluate(() => { const v = document.querySelector('#film-opening video.in-dark'); return { t: v.currentTime, paused: v.paused, src: v.currentSrc }; });
  ok(`${ename}: opening film plays in view`, st.t > 0.5 && /opening-dark\.mp4$/.test(st.src), JSON.stringify(st));
  await p.waitForTimeout(10000);
  st = await p.evaluate(() => { const v = document.querySelector('#film-opening video.in-dark'); return { t: v.currentTime, ended: v.ended, d: v.duration }; });
  ok(`${ename}: plays once and holds the last frame`, st.ended && Math.abs(st.t - st.d) < 0.2, JSON.stringify(st));
  await p.click('[data-replay="film-opening"]'); await p.waitForTimeout(1200);
  st = await p.evaluate(() => { const v = document.querySelector('#film-opening video.in-dark'); return { t: v.currentTime, paused: v.paused }; });
  ok(`${ename}: Replay plays again from the start`, !st.paused && st.t < 3, JSON.stringify(st));
  await p.evaluate(() => document.querySelector('[data-theme-choice="light"]').click()); await p.waitForTimeout(1500); // pressed where it is, without scrolling the film away
  st = await p.evaluate(() => ({ attr: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor, stored: localStorage.getItem('jv-theme'), lightPlaying: !document.querySelector('#film-opening video.in-light').paused, lightVisible: !!document.querySelector('#film-opening video.in-light').offsetParent, darkVisible: !!document.querySelector('#film-opening video.in-dark').offsetParent }));
  ok(`${ename}: Light switch: colours, film and memory`, st.attr === 'light' && st.bg === 'rgb(245, 245, 247)' && st.stored === 'light' && st.lightVisible && !st.darkVisible && st.lightPlaying, JSON.stringify(st));
  await p.goto(BASE + '/help');
  st = await p.evaluate(() => ({ attr: document.documentElement.dataset.theme, pressed: document.querySelector('[data-theme-choice="light"]').getAttribute('aria-pressed') }));
  ok(`${ename}: theme remembered on the next page`, st.attr === 'light' && st.pressed === 'true', JSON.stringify(st));
  await p.click('[data-theme-choice="device"]');
  st = await p.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), stored: localStorage.getItem('jv-theme'), bg: getComputedStyle(document.body).backgroundColor }));
  ok(`${ename}: Device follows the visitor's setting again`, st.attr === null && st.stored === null && st.bg === 'rgb(10, 10, 15)', JSON.stringify(st));
  const q = p.locator('[data-faq]').nth(2); await q.click();
  st = await p.evaluate(() => [...document.querySelectorAll('[data-faq]')].map(b => b.getAttribute('aria-expanded') + ':' + !document.getElementById(b.getAttribute('aria-controls')).hidden));
  ok(`${ename}: Help opens one answer at a time`, st.filter(x => x === 'true:true').length === 1 && st[2] === 'true:true', st.join(','));
  await p.goto(BASE + '/circle'); await p.click('[data-circle-sec="kin"] [data-sec-more]'); await p.click('[data-circle-sec="family"] [data-sec-more]');
  st = await p.evaluate(() => [...document.querySelectorAll('[data-sec-panel]')].filter(x => !x.hidden).length);
  ok(`${ename}: Circle laptop opens several sections`, st === 2, String(st));
  await p.click('[data-circle-sec="kin"] [data-sec-panel] [data-sec-toggle]');
  st = await p.evaluate(() => ({ open: [...document.querySelectorAll('[data-sec-panel]')].filter(x => !x.hidden).length, more: !document.querySelector('[data-circle-sec="kin"] [data-sec-more]').hidden }));
  ok(`${ename}: Circle Less closes it`, st.open === 1 && st.more, JSON.stringify(st));
  await p.goto(BASE + '/what-it-does'); await p.waitForTimeout(500);
  st = await p.evaluate(() => [...document.querySelectorAll('[data-arrows]')].map(a => a.id || a.getAttribute('data-arrows') + ':' + !a.hidden));
  ok(`${ename}: carousel arrows only where a row overflows`, st.join() === 'rail-remember:true,rail-done:true,rail-watch:false', st.join());
  await ctx.close();
  // Phone
  ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', isMobile: ename === 'chromium', hasTouch: true }); p = await ctx.newPage();
  await p.goto(BASE + '/what-it-does');
  await p.locator('[data-menu-toggle]').click();
  st = await p.evaluate(() => ({ open: !document.getElementById('phone-menu').hidden, exp: document.querySelector('[data-menu-toggle]').getAttribute('aria-expanded') }));
  ok(`${ename}: phone menu opens`, st.open && st.exp === 'true', JSON.stringify(st));
  await p.locator('[data-menu-toggle]').click();
  await p.locator('#film-find [data-fs-open]').scrollIntoViewIfNeeded(); await p.locator('#film-find [data-fs-open]').click(); await p.waitForTimeout(1500);
  st = await p.evaluate(() => { const fs = document.getElementById('film-fs'), v = fs.querySelector('video'); return { open: !fs.hidden, src: v.currentSrc, t: v.currentTime, w: v.getBoundingClientRect().width }; });
  ok(`${ename}: phone opens a film full screen`, st.open && /find-light\.mp4$/.test(st.src) && st.t > 0.3, JSON.stringify(st));
  await p.keyboard.press('Escape'); st = await p.evaluate(() => document.getElementById('film-fs').hidden);
  ok(`${ename}: Escape closes it`, st);
  await p.goto(BASE + '/circle'); await p.click('[data-circle-sec="family"] [data-sec-more]'); await p.click('[data-circle-sec="kin"] [data-sec-more]');
  st = await p.evaluate(() => [...document.querySelectorAll('[data-sec-panel]')].filter(x => !x.hidden).map(x => x.id));
  ok(`${ename}: Circle phone keeps one section open`, st.join() === 'panel-kin', st.join());
  const sw = await p.evaluate(() => document.documentElement.scrollWidth); ok(`${ename}: no sideways scroll on the phone`, sw <= 390, String(sw));
  await ctx.close();
  // Reduced motion: the still, no Replay
  ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce' }); p = await ctx.newPage();
  await p.goto(BASE + '/'); await p.locator('#film-opening').scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
  st = await p.evaluate(() => { const v = document.querySelector('#film-opening video.in-dark'); return { paused: v.paused, t: v.currentTime, poster: v.getAttribute('poster'), replay: !!document.querySelector('[data-replay]').offsetParent }; });
  ok(`${ename}: reduced motion shows the still, no Replay`, st.paused && st.t === 0 && /opening-dark\.jpg$/.test(st.poster) && !st.replay, JSON.stringify(st));
  await ctx.close(); await b.close();
}
console.log(results.join('\n')); if (results.some(r => r.startsWith('FAIL'))) process.exit(1);
