// jeevanto.com: the little the pages do. No cookies, no requests to other hosts, nothing sent anywhere.
(function () {
  'use strict';
  var root = document.documentElement;
  var phoneMq = window.matchMedia('(max-width: 719px)');
  var lightMq = window.matchMedia('(prefers-color-scheme: light)');
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Dark unless chosen otherwise; "device" follows the visitor's setting.
  function theme() { var t = root.getAttribute('data-theme'); return t === 'light' ? 'light' : t === 'device' ? (lightMq.matches ? 'light' : 'dark') : 'dark'; }
  function listen(mq, fn) { try { mq.addEventListener('change', fn); } catch (e) { try { mq.addListener(fn); } catch (e2) {} } }

  // ---- Device / Light / Dark (footer). Kept in this browser only.
  function choice() { var t = root.getAttribute('data-theme'); return t === 'light' || t === 'device' ? t : 'dark'; }
  function paintSwitch() { document.querySelectorAll('[data-theme-choice]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-choice') === choice())); }); }
  document.querySelectorAll('[data-theme-choice]').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-theme-choice');
      root.setAttribute('data-theme', k);
      try { localStorage.setItem('jv-theme', k); } catch (e) {}
      paintSwitch(); themeChanged();
    });
  });
  paintSwitch();
  listen(lightMq, function () { if (choice() === 'device') themeChanged(); });

  // ---- Phone menu
  var menuBtn = document.querySelector('[data-menu-toggle]'), menu = document.getElementById('phone-menu');
  if (menuBtn && menu) menuBtn.addEventListener('click', function () {
    var open = menu.hasAttribute('hidden'); if (open) menu.removeAttribute('hidden'); else menu.setAttribute('hidden', '');
    menuBtn.setAttribute('aria-expanded', String(open));
  });

  // ---- Films: each plays once, from the start, when it is in prime view (60% visible), then holds on its
  // "Ends on" frame. Replay plays it again. Reduced motion: the "Ends on" frame only, and no Replay.
  if (still.matches) root.classList.add('replay-off');
  var films = [].slice.call(document.querySelectorAll('[data-film]'));
  function vid(f) { return f.querySelector('video.' + (theme() === 'light' ? 'in-light' : 'in-dark')); }
  function playFrom0(v) { if (!v || still.matches) return; try { v.currentTime = 0; } catch (e) {} var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  films.forEach(function (f) {
    f.querySelectorAll('video').forEach(function (v) {
      v.muted = true; v.defaultMuted = true; v.playsInline = true;
      if (!still.matches && v.dataset.first) v.poster = v.dataset.first;
    });
  });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var f = e.target, seen = e.isIntersecting && e.intersectionRatio >= 0.6;
        if (seen && !f.dataset.played) { f.dataset.played = theme(); playFrom0(vid(f)); }
      });
    }, { threshold: [0, 0.3, 0.6, 0.9, 1] });
    films.forEach(function (f) { io.observe(f); });
  }
  function ratio(f) { var r = f.getBoundingClientRect(), h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)), w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)); return r.width && r.height ? (h * w) / (r.width * r.height) : 0; }
  function themeChanged() {
    films.forEach(function (f) {
      f.querySelectorAll('video').forEach(function (v) { try { v.pause(); } catch (e) {} });
      // WebKit won't play a video in the same task that un-hides it, so wait a frame for the new theme's layout.
      if (f.dataset.played && f.dataset.played !== theme()) { if (ratio(f) >= 0.6) { f.dataset.played = theme(); requestAnimationFrame(function () { requestAnimationFrame(function () { playFrom0(vid(f)); }); }); } else delete f.dataset.played; }
    });
    if (fsOpen) fsShow(fsName, fsTitle);
  }
  document.querySelectorAll('[data-replay]').forEach(function (b) {
    b.addEventListener('click', function () { var f = document.getElementById(b.getAttribute('data-replay')); if (f) { f.dataset.played = theme(); playFrom0(vid(f)); } });
  });

  // ---- Phones: tap a film to see it full screen.
  var fs = document.getElementById('film-fs'), fsOpen = false, fsName = '', fsTitle = '', fsBack = null;
  function fsShow(name, title) {
    if (!fs) return; fsName = name; fsTitle = title; fsOpen = true;
    var v = fs.querySelector('video'), t = theme();
    v.poster = '/films/' + name + '-' + t + '.jpg'; v.src = '/films/' + name + '-' + t + '.mp4';
    fs.setAttribute('aria-label', title); fs.hidden = false; document.body.style.overflow = 'hidden';
    playFrom0(v); var c = fs.querySelector('[data-fs-close]'); if (c) c.focus();
  }
  function fsHide() { if (!fs || !fsOpen) return; fsOpen = false; var v = fs.querySelector('video'); try { v.pause(); } catch (e) {} v.removeAttribute('src'); v.load(); fs.hidden = true; document.body.style.overflow = ''; if (fsBack) fsBack.focus(); }
  document.querySelectorAll('[data-fs-open]').forEach(function (b) {
    b.addEventListener('click', function () { fsBack = b; fsShow(b.getAttribute('data-fs-open'), b.getAttribute('data-fs-title') || 'The film'); });
  });
  if (fs) fs.querySelector('[data-fs-close]').addEventListener('click', fsHide);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fsHide(); });

  // ---- Carousels (What it does): arrows on a laptop, only when a row doesn't fit.
  var rails = [].slice.call(document.querySelectorAll('[data-rail]'));
  function measure() { rails.forEach(function (r) { var a = document.querySelector('[data-arrows="' + r.id + '"]'); if (a) a.hidden = phoneMq.matches || !(r.scrollWidth > r.clientWidth + 2); }); }
  rails.forEach(function (r) {
    document.querySelectorAll('[data-scroll="' + r.id + '"]').forEach(function (b) {
      b.addEventListener('click', function () { r.scrollBy({ left: Number(b.getAttribute('data-dir')) * r.clientWidth * 0.8, behavior: still.matches ? 'auto' : 'smooth' }); });
    });
  });
  if (rails.length) { measure(); window.addEventListener('resize', measure); listen(phoneMq, measure); if (document.fonts) document.fonts.ready.then(measure); }

  // ---- Circle: More / Less. On a phone one section is open at a time. The tapped section stays where it is
  // when others close above it; after "Less", its heading comes back into view.
  document.querySelectorAll('[data-sec-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var sec = b.closest('[data-circle-sec]'), id = sec.getAttribute('data-circle-sec');
      var panel = sec.querySelector('[data-sec-panel]'), opening = panel.hidden, before = sec.getBoundingClientRect().top;
      if (phoneMq.matches && opening) document.querySelectorAll('[data-circle-sec]').forEach(function (o) { if (o !== sec) setSec(o, false); });
      setSec(sec, opening);
      var now = sec.getBoundingClientRect().top, dy = opening ? now - before : Math.min(0, now - 72);
      if (dy) window.scrollBy(0, dy);
      if (!opening) { var m = sec.querySelector('[data-sec-more]'); if (m) m.focus({ preventScroll: true }); }
    });
  });
  function setSec(sec, open) {
    var panel = sec.querySelector('[data-sec-panel]'); panel.hidden = !open;
    var more = sec.querySelector('[data-sec-more]'); if (more) { more.hidden = open; more.setAttribute('aria-expanded', String(open)); }
  }

  // ---- Help: common questions, one open at a time.
  document.querySelectorAll('[data-faq]').forEach(function (b) {
    b.addEventListener('click', function () {
      var open = b.getAttribute('aria-expanded') !== 'true';
      document.querySelectorAll('[data-faq]').forEach(function (o) { setFaq(o, false); });
      setFaq(b, open);
    });
  });
  function setFaq(b, open) { b.setAttribute('aria-expanded', String(open)); var a = document.getElementById(b.getAttribute('aria-controls')); if (a) a.hidden = !open; var c = b.querySelector('[data-chev]'); if (c) c.style.transform = open ? 'rotate(180deg)' : 'none'; }
})();
