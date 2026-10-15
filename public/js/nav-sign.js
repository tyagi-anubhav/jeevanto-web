// The nav's top-right corner (founder, 10 Oct 12:50): "Sign in" while signed out, "Sign out" while signed in, on every
// page, and the person's name beside Sign out (founder, 15 Oct 22:10). It reads the one sign-in record (jv-sign-in,
// decision 231): whether it is there, and the name it keeps, nothing else. Sign out opens
// /sign-in#sign-out, which signs out: only the sign-in pages may reach the engine (the pages' own CSP).
(function () {
  'use strict';
  function set() {
    var a = document.querySelector('[data-nav-sign]'); if (!a) return;
    var rec = null; try { rec = JSON.parse(localStorage.getItem('jv-sign-in') || 'null'); } catch (e) {}
    var on = !!rec;
    a.textContent = on ? 'Sign out' : 'Sign in';
    // signed in: the person's name beside it (founder, 15 Oct 22:10): the name only, nothing else
    var n = document.querySelector('[data-nav-name]');
    if (n) { var name = on && typeof rec.name === 'string' ? rec.name.trim() : ''; n.textContent = name; n.hidden = !name; }
    a.setAttribute('href', on ? '/sign-in#sign-out' : '/sign-in');
  }
  window.jvNavSign = set;
  set();
})();
