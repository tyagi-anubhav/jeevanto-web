// jeevanto.com: the calls to ENGINES' doors, for /check, /recover, /recover/answer and /invited
// (cc-wave-23-to-website-the-doors-2026-10-01.md). Nothing is called until the visitor presses a button, or the
// page was opened from a link that carries what it needs. No cookie; nothing is stored in the browser.
(function () {
  // the product's name from the page's own og:site_name, which the shell fills from the one source (decision 245)
  var NAME = (document.querySelector('meta[property="og:site_name"]') || {}).content;
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
    // "couldn't reach" only when the engine really wasn't reached (no answer, or a server error). A refusal it answered
    // with (a 4xx carrying a reason) isn't a lost connection, and saying so isn't true (WEBSITE, 12 Oct: a 409 showed it).
    if (res.status === 0 || res.status >= 500) return 'We couldn’t reach ' + NAME + ' just now. Try again in a little while.';
    return 'That didn’t go through. Write to help@jeevanto.com, and we’ll look into it.';
  };
  window.jvShow = function (root, name) { root.querySelectorAll('[data-state]').forEach(function (el) { el.hidden = el.getAttribute('data-state').split(' ').indexOf(name) < 0; }); };
  window.jvBusy = function (btn, on) { if (btn) { btn.disabled = !!on; btn.setAttribute('aria-busy', on ? 'true' : 'false'); } };
  window.jvName = function (root, name) { root.querySelectorAll('[data-name]').forEach(function (el) { el.textContent = name; }); };
  window.jvWhen = function (iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    // the visitor's region (decision 246, /js/region.js): "6 Oct 2026, 9:14 am" or "Oct 6, 2026, 9:14 am", the clock as the region writes it
    var R = window.jvRegion;
    var day = R ? R.date(d, true) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    var t = R ? R.time(d) : d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s?([ap])\.?m\.?$/i, ' $1m').toLowerCase();
    return day + ', ' + t;
  };
})();
