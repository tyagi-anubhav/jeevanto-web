// Dates and numbers follow the visitor's own region (decision 246). The pages are built with the default — day first
// ("6 October 2026") and Indian grouping ("1,72,000") — which is also what shows with no script. Here each marked date
// and number is rewritten for the browser's region: month first in the US and Canada ("October 6, 2026"), day first
// elsewhere; lakh grouping in India, thousands elsewhere ("172,000"). The words around them never change.
(function () {
  'use strict';
  var langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
  var region = '';
  for (var i = 0; i < langs.length && !region; i++) { var m = /^[a-z]{2,3}[-_]([a-z]{2})\b/i.exec(langs[i] || ''); if (m) region = m[1].toUpperCase(); }
  var monthFirst = region === 'US' || region === 'CA', lakh = !region || region === 'IN';
  var LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function parts(d) { return { d: d.getDate(), m: d.getMonth(), y: d.getFullYear() }; }
  window.jvRegion = {
    region: region,
    // "6 October 2026" / "October 6, 2026" (and the short month for "6 Oct 2026" / "Oct 6, 2026")
    date: function (d, short) { var p = parts(d), mo = short ? LONG[p.m].slice(0, 3) : LONG[p.m]; return monthFirst ? mo + ' ' + p.d + ', ' + p.y : p.d + ' ' + mo + ' ' + p.y; },
    // the clock as the region writes it (12- or 24-hour); "am"/"pm" kept lower case, as the site writes them
    time: function (d) { return d.toLocaleTimeString(langs[0] || undefined, { hour: 'numeric', minute: '2-digit' }).replace(/\s?([AaPp])\.?\s?[Mm]\.?$/, function (x, ap) { return ' ' + ap.toLowerCase() + 'm'; }); },
    num: function (n) { return Number(n).toLocaleString(lakh ? 'en-IN' : 'en-US'); },
  };
  if (!region) return; // no region known: the built default stands
  document.querySelectorAll('[data-jv-date]').forEach(function (el) {
    var iso = el.getAttribute('data-jv-date').split('-'), s = window.jvRegion.date(new Date(+iso[0], +iso[1] - 1, +iso[2]));
    el.textContent = el.hasAttribute('data-jv-upper') ? s.toUpperCase() : s;
  });
  document.querySelectorAll('[data-jv-num]').forEach(function (el) { el.textContent = window.jvRegion.num(el.getAttribute('data-jv-num')); });
})();
