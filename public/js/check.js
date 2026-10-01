// /check: one reference, one call. "Not one of ours" is the same for a mistyped, old or forged reference.
(function () {
  'use strict';
  var root = document.querySelector('[data-check]'); if (!root || !window.jvDoor) return;
  var form = root.querySelector('form'), input = root.querySelector('#chk-ref'), err = root.querySelector('[data-err]'), btn = form.querySelector('button');
  function fail(msg) { err.textContent = msg; err.hidden = !msg; input.setAttribute('aria-invalid', msg ? 'true' : 'false'); }
  input.addEventListener('input', function () { fail(''); if (!root.querySelector('[data-state="none"]').hidden) jvShow(root, 'ask'); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ref = input.value.trim();
    if (!ref) { fail('Type the reference from the end of the message.'); input.focus(); return; }
    fail(''); jvBusy(btn, true);
    jvDoor('check', { reference: ref }).then(function (res) {
      jvBusy(btn, false);
      var b = res.body;
      if (res.status === 200 && b.ok && b.real) {
        root.querySelector('[data-f="sent_to"]').textContent = b.sent_to || '';
        root.querySelector('[data-f="sent_on"]').textContent = b.sent_at ? jvWhen(b.sent_at) : (b.sent_on || '');
        root.querySelector('[data-f="about"]').textContent = b.about || '';
        jvShow(root, 'real'); root.querySelector('[data-again]').focus();
      } else if (res.status === 200 && b.ok && b.real === false) {
        jvShow(root, 'none');
      } else fail(jvTrouble(res));
    });
  });
  root.querySelector('[data-again]').addEventListener('click', function () { input.value = ''; fail(''); jvShow(root, 'ask'); input.focus(); });
})();
