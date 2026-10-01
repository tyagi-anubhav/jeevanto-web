// jeevanto.com: the calls to ENGINES' doors, for /check, /recover, /recover/answer and /invited
// (cc-wave-23-to-website-the-doors-2026-10-01.md). Nothing is called until the visitor presses a button, or the
// page was opened from a link that carries what it needs. No cookie; nothing is stored in the browser.
(function () {
  'use strict';
  var meta = document.querySelector('meta[name="jv-engine"]');
  if (!meta) return;
  var BASE = meta.getAttribute('content'), KEY = meta.getAttribute('data-key');
  window.jvDoor = function (action, body) {
    var payload = Object.assign({ action: action }, body || {});
    return fetch(BASE + '/functions/v1/recovery-web', {
      method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY },
      body: JSON.stringify(payload),
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j || {} }; }); },
      function () { return { status: 0, body: { ok: false, error: 'UNREACHABLE' } }; });
  };
  // The page's own words for the answers every door can give (the design draws none of these).
  window.jvTrouble = function (res) {
    var e = res.body && res.body.error;
    if (res.status === 429 || e === 'RATE_LIMITED') return 'Too many tries from here. Try again in an hour.';
    return 'We couldn’t reach Jeevanto just now. Try again in a little while.';
  };
  window.jvShow = function (root, name) { root.querySelectorAll('[data-state]').forEach(function (el) { el.hidden = el.getAttribute('data-state').split(' ').indexOf(name) < 0; }); };
  window.jvBusy = function (btn, on) { if (btn) { btn.disabled = !!on; btn.setAttribute('aria-busy', on ? 'true' : 'false'); } };
  window.jvName = function (root, name) { root.querySelectorAll('[data-name]').forEach(function (el) { el.textContent = name; }); };
  window.jvWhen = function (iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    var day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    var t = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s?([ap])\.?m\.?$/i, ' $1m').toLowerCase();
    return day + ', ' + t;
  };
})();
