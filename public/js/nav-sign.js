// The nav's top-right corner (founder, 10 Oct 12:50): "Sign in" while signed out, "Sign out" while signed in, on every
// page. It reads whether the one sign-in record (jv-sign-in, decision 231) is there, and nothing else. Sign out opens
// /sign-in#sign-out, which signs out: only the sign-in pages may reach the engine (the pages' own CSP).
(function () {
  'use strict';
  function set() {
    var a = document.querySelector('[data-nav-sign]'); if (!a) return;
    var on = false; try { on = !!localStorage.getItem('jv-sign-in'); } catch (e) {}
    a.textContent = on ? 'Sign out' : 'Sign in';
    a.setAttribute('href', on ? '/sign-in#sign-out' : '/sign-in');
  }
  window.jvNavSign = set;
  set();
})();
