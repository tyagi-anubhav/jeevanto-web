// /recover: the recovery contact's door. The session lives only in this page's memory (30 minutes, the engine's
// rule); a reload starts again at the front door. The digits always go to the contact, never to this page.
(function () {
  'use strict';
  var root = document.querySelector('[data-recover]'); if (!root || !window.jvDoor) return;
  var DIGITS = root.getAttribute('data-digits');
  var st = { attempt: null, session: null, people: [], cur: null };
  var $ = function (s, r) { return (r || root).querySelector(s); };
  var front = $('[data-front]'), dest = $('#rc-dest'), frontErr = $('#rc-front-err'), sent = $('[data-sent]'), code = $('#rc-code'), codeErr = $('#rc-code-err');
  var popName = document.querySelector('[data-pop="name"]'), popStop = document.querySelector('[data-pop="stop"]');

  function say(el, msg) { el.textContent = msg || ''; el.hidden = !msg; }
  function go(state) { closePops(); jvShow(root, state); var h = root.querySelector('[data-state="' + state + '"] h1'); if (h && state !== 'front') h.focus(); window.scrollTo(0, 0); }
  function setName(n) { jvName(document, n); document.querySelectorAll('[data-name-upper]').forEach(function (e) { e.textContent = n.toUpperCase(); }); }
  function signedOut() { st.session = null; st.attempt = null; sent.hidden = true; code.value = ''; go('front'); say(frontErr, 'Your 30 minutes are up. Ask for a new code.'); }
  function wrongCode(b, el) { if (b.too_many) { say(el, 'Too many tries. Ask for a new code.'); return true; } say(el, 'That code isn’t right. ' + (b.attempts_left != null ? b.attempts_left + (b.attempts_left === 1 ? ' try left.' : ' tries left.') : '')); return false; }
  var MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, MOB = /^\+\d{1,4}[\s-]?\d[\d\s-]{6,14}$/;

  // 4 · the front door: the same answer for a contact and a stranger
  front.addEventListener('submit', function (e) { e.preventDefault(); sendCode(); });
  $('[data-send]').addEventListener('click', function (e) { e.preventDefault(); sendCode(); });
  function sendCode() {
    var v = dest.value.trim();
    if (!v) { say(frontErr, 'Enter your email or mobile number.'); dest.setAttribute('aria-invalid', 'true'); return; }
    if (!MAIL.test(v) && !MOB.test(v)) { say(frontErr, 'Check the email or mobile number.'); dest.setAttribute('aria-invalid', 'true'); return; }
    say(frontErr, ''); dest.setAttribute('aria-invalid', 'false'); var btn = $('[data-send]'); jvBusy(btn, true);
    jvDoor('door_code_start', { destination: v }).then(function (res) {
      jvBusy(btn, false);
      if (res.status === 200 && res.body.ok) { st.attempt = res.body.attempt_id; sent.hidden = false; btn.hidden = true; say(codeErr, ''); code.focus(); }
      else if (res.body.error === 'BAD_DESTINATION') say(frontErr, 'Check the email or mobile number.');
      else say(frontErr, jvTrouble(res));
    });
  }
  dest.addEventListener('input', function () { if (st.attempt) { st.attempt = null; sent.hidden = true; $('[data-send]').hidden = false; code.value = ''; } say(frontErr, ''); });
  $('[data-verify]').addEventListener('click', function () {
    var c = code.value.replace(/\s/g, ''); if (!c) { say(codeErr, 'Type the code we sent you.'); return; }
    var btn = this; jvBusy(btn, true);
    jvDoor('door_code_verify', { attempt_id: st.attempt, code: c }).then(function (res) {
      jvBusy(btn, false); var b = res.body;
      if (res.status === 200 && b.ok && b.verified) { st.session = b.session; loadPeople(); }
      else if (res.status === 200 && b.ok && b.verified === false) { if (wrongCode(b, codeErr)) { st.attempt = null; sent.hidden = true; $('[data-send]').hidden = false; code.value = ''; } }
      else say(codeErr, jvTrouble(res));
    });
  });

  // 5 · your people
  function daysLeft(iso) { var ms = new Date(iso) - Date.now(); if (!(ms > 0)) return 'Started. Nearly done.'; var d = Math.ceil(ms / 86400000); return 'Started. About ' + d + (d === 1 ? ' day' : ' days') + ' left.'; }
  function loadPeople(msg) {
    return jvDoor('door_people', { session: st.session }).then(function (res) {
      if (res.status === 401) return signedOut();
      if (!(res.status === 200 && res.body.ok)) { go('front'); sent.hidden = true; $('[data-send]').hidden = false; say(frontErr, jvTrouble(res)); return; }
      st.people = res.body.people || []; render(); go('people');
      var m = $('[data-people-msg]'); m.textContent = msg || (st.people.length ? '' : 'There’s no one for you to help right now.'); m.hidden = !m.textContent;
    });
  }
  function render() {
    var list = $('[data-list]'); list.textContent = '';
    st.people.forEach(function (p) {
      var el = document.getElementById('rc-person').content.firstElementChild.cloneNode(true), q = function (k) { return el.querySelector('[data-p="' + k + '"]'); };
      var n = p.name || '', s = p.status;
      q('name').textContent = n;
      var waiting = s === 'waiting', over = s === 'wait_over';
      q('status').textContent = waiting ? daysLeft(p.hold_until) : over ? 'The wait is over.' : s === 'stopped' ? n + ' has stopped this.' : s === 'done' ? n + '’s back in.' : 'Nothing happening';
      if (over) q('status').style.color = 'var(--sage)';
      q('idle').hidden = waiting || over;
      q('start').textContent = 'Start ' + n + '’s way back in'; q('stop').textContent = 'Stop being ' + n + '’s recovery contact';
      q('waiting').hidden = !waiting; q('waiting').textContent = n + '’s way back in is under way. You can step down once it’s finished.';
      q('send').hidden = !over; q('err').hidden = true;
      q('start').addEventListener('click', function () { st.cur = p; setName(n); openPop(popName); var i = document.getElementById('rc-name'); i.value = ''; i.placeholder = n; document.getElementById('rc-name-err').hidden = true; i.focus(); });
      q('stop').addEventListener('click', function () { st.cur = p; setName(n); say(document.querySelector('[data-stop-err]'), ''); openPop(popStop); document.querySelector('[data-stop-go]').focus(); });
      q('send').addEventListener('click', function () { st.cur = p; setName(n); sendDigits(q('send'), q('err')); });
      list.appendChild(el);
    });
  }

  // 6 · type the name, the warning, start
  var lastFocus = null;
  function openPop(p) { lastFocus = document.activeElement; p.hidden = false; }
  function closePops() { [popName, popStop].forEach(function (p) { p.hidden = true; }); }
  [popName, popStop].forEach(function (p) { p.addEventListener('click', function (e) { if (e.target === p) { closePops(); if (lastFocus) lastFocus.focus(); } }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && (!popName.hidden || !popStop.hidden)) { closePops(); if (lastFocus) lastFocus.focus(); } });
  document.querySelector('[data-pop-close]').addEventListener('click', function () { closePops(); if (lastFocus) lastFocus.focus(); });
  function norm(x) { return String(x || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function nameGo() {
    var typed = document.getElementById('rc-name').value;
    if (norm(typed) !== norm(st.cur.name)) { document.getElementById('rc-name-err').hidden = false; return; }
    st.typed = typed.trim(); say($('[data-warn-err]'), ''); go('warn');
  }
  document.querySelector('[data-name-go]').addEventListener('click', nameGo);
  document.getElementById('rc-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') nameGo(); });
  document.getElementById('rc-name').addEventListener('input', function () { document.getElementById('rc-name-err').hidden = true; });
  $('[data-back]').addEventListener('click', function () { go('people'); });
  $('[data-start]').addEventListener('click', function () {
    var btn = this; jvBusy(btn, true);
    jvDoor('door_start', { session: st.session, recovery_contact_id: st.cur.recovery_contact_id, typed_name: st.typed }).then(function (res) {
      jvBusy(btn, false); var e = res.body.error;
      if (res.status === 200 && res.body.ok) go('started');
      else if (res.status === 401) signedOut();
      else if (e === 'NAME_MISMATCH') { go('people'); openPop(popName); document.getElementById('rc-name-err').hidden = false; }
      else if (e === 'RECENTLY_VETOED') say($('[data-warn-err]'), st.cur.name + ' stopped a way back in not long ago, so it can’t be started again just yet.');
      else if (e === 'NOT_FOUND' || e === 'OWNER_UNREACHABLE') say($('[data-warn-err]'), 'We couldn’t start this. Write to help@jeevanto.com, and we’ll look into it.');
      else say($('[data-warn-err]'), jvTrouble(res));
    });
  });

  // 7 · the digits, sent to the contact
  function sendDigits(btn, errEl) {
    jvBusy(btn, true);
    jvDoor('door_send_digits', { session: st.session, recovery_contact_id: st.cur.recovery_contact_id }).then(function (res) {
      jvBusy(btn, false); var e = res.body.error;
      if (res.status === 200 && res.body.ok) { $('[data-sent-to]').textContent = res.body.sent_to || ''; go('digits'); }
      else if (res.status === 401) signedOut();
      else if (e === 'HOLD_NOT_ELAPSED') say(errEl, 'The wait isn’t over yet. ' + daysLeft(res.body.hold_until).replace('Started. ', ''));
      else if (e === 'NOTHING_WAITING') loadPeople();
      else if (e === 'DIGITS_NOT_SENT') say(errEl, 'We couldn’t send the ' + DIGITS + ' digits just now. Try again in a little while.');
      else say(errEl, jvTrouble(res));
    });
  }

  // 8 · step down
  document.querySelector('[data-stop-go]').addEventListener('click', function () {
    var btn = this, err = document.querySelector('[data-stop-err]'); jvBusy(btn, true);
    jvDoor('door_step_down', { session: st.session, recovery_contact_id: st.cur.recovery_contact_id }).then(function (res) {
      jvBusy(btn, false);
      if (res.status === 200 && res.body.ok) go('stepped');
      else if (res.status === 401) signedOut();
      else if (res.body.error === 'LIVE_FLOW') say(err, st.cur.name + '’s way back in is under way. You can step down once it’s finished.');
      else say(err, jvTrouble(res));
    });
  });

  // 9 · update my email or mobile
  $('[data-to-update]').addEventListener('click', function () {
    root.querySelectorAll('[data-upd]').forEach(function (c) { c.querySelector('[data-upd-code]').hidden = true; c.querySelector('[data-upd-code]').value = ''; c.querySelector('[data-upd-btn]').hidden = false; c.querySelector('[data-upd-btn]').textContent = 'Send a code'; say(c.querySelector('[data-upd-err]'), ''); c.querySelector('[data-upd-saved]').hidden = true; delete c.dataset.challenge; });
    go('update');
  });
  $('[data-to-people]').addEventListener('click', function () { loadPeople(); });
  root.querySelectorAll('[data-upd]').forEach(function (card) {
    var mail = card.getAttribute('data-upd') === 'mail', btn = card.querySelector('[data-upd-btn]'), codeIn = card.querySelector('[data-upd-code]'), err = card.querySelector('[data-upd-err]');
    function value() { return mail ? card.querySelector('#rc-upd-mail').value.trim() : window.jvMobile(card.querySelector('[data-mobile]')); }
    btn.addEventListener('click', function () {
      var v = value();
      if (!card.dataset.challenge) {
        if (mail ? !MAIL.test(v) : !/^\+\d{8,16}$/.test(v)) { say(err, mail ? 'Check the email.' : 'Check the mobile number.'); return; }
        say(err, ''); jvBusy(btn, true);
        jvDoor('door_update_start', { session: st.session, destination: v }).then(function (res) {
          jvBusy(btn, false);
          if (res.status === 200 && res.body.ok) { card.dataset.challenge = res.body.challenge_id; card.dataset.dest = v; codeIn.hidden = false; btn.textContent = 'Save'; codeIn.focus(); }
          else if (res.status === 401) signedOut();
          else if (res.body.error === 'BAD_DESTINATION') say(err, mail ? 'Check the email.' : 'Check the mobile number.');
          else say(err, jvTrouble(res));
        });
      } else {
        var c = codeIn.value.replace(/\s/g, ''); if (!c) { say(err, 'Type the code we sent you.'); return; }
        jvBusy(btn, true);
        jvDoor('door_update_confirm', { session: st.session, challenge_id: card.dataset.challenge, code: c, destination: card.dataset.dest }).then(function (res) {
          jvBusy(btn, false); var b = res.body;
          if (res.status === 200 && b.ok && b.verified && b.updated !== false) { say(err, ''); codeIn.hidden = true; btn.hidden = true; card.querySelector('[data-upd-saved]').hidden = false; }
          else if (res.status === 200 && b.ok && b.verified === false) { if (wrongCode(b, err)) { delete card.dataset.challenge; codeIn.hidden = true; codeIn.value = ''; btn.textContent = 'Send a code'; } }
          else if (res.status === 401) signedOut();
          else say(err, jvTrouble(res));
        });
      }
    });
  });
})();
