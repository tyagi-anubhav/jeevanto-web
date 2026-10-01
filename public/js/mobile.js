// The mobile field's country code, filled from the visitor's time zone (as the design does) and editable.
(function () {
  'use strict';
  var z = ''; try { z = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var c = /Kolkata|Calcutta/.test(z) ? 'in' : /^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Regina|St_Johns)/.test(z) ? 'ca' : /^America\//.test(z) ? 'us' : /Europe\/London/.test(z) ? 'uk' : /Dubai/.test(z) ? 'ae' : /Singapore/.test(z) ? 'sg' : /^Australia\//.test(z) ? 'au' : 'in';
  document.querySelectorAll('[data-cc]').forEach(function (s) { var o = s.querySelector('option[data-c="' + c + '"]'); if (o) o.selected = true; });
  window.jvMobile = function (wrap) { var s = wrap.querySelector('[data-cc]'), i = wrap.querySelector('input'); var n = i.value.replace(/[^\d]/g, ''); if (/^\s*\+/.test(i.value)) return '+' + n; return n ? s.value + n : ''; };
})();
