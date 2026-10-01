// /invited: the inviter's first name for a live code; "Someone" for an unknown, expired, used or blank one.
// The call doesn't use the code up.
(function () {
  'use strict';
  var root = document.querySelector('[data-invite]'); if (!root || !window.jvDoor) return;
  var form = root.querySelector('form'), input = root.querySelector('#inv-code'), err = root.querySelector('[data-err]'), who = root.querySelector('[data-inviter]'), btn = form.querySelector('button');
  function look(code) {
    err.hidden = true; jvBusy(btn, true);
    return jvDoor('invite_name', { code: code }).then(function (res) {
      jvBusy(btn, false);
      if (res.status === 200 && res.body.ok) { who.textContent = res.body.name || 'Someone'; }
      else { who.textContent = 'Someone'; err.textContent = jvTrouble(res); err.hidden = false; }
    });
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); var c = input.value.trim(); if (!c) { err.textContent = 'Type the code from their message.'; err.hidden = false; input.focus(); return; } look(c); });
  var fromLink = new URLSearchParams(location.search).get('c');
  if (fromLink) { input.value = fromLink.toUpperCase(); look(fromLink); }
})();
