// /recover/answer: the ask, from the link in its email. r and t go back to the engine unchanged.
(function () {
  'use strict';
  var root = document.querySelector('[data-answer]'); if (!root || !window.jvDoor) return;
  var q = new URLSearchParams(location.search), R = q.get('r'), T = q.get('t');
  var $ = function (s) { return root.querySelector(s); };
  function say(el, m) { el.textContent = m || ''; el.hidden = !m; }
  function go(s) { jvShow(root, s); var h = root.querySelector('[data-state="' + s + '"] h1'); if (h) h.focus(); }
  function trouble(res) { $('[data-trouble]').textContent = jvTrouble(res); go('trouble'); }
  function named(n) { jvName(document, n); document.querySelectorAll('[data-name-upper]').forEach(function (e) { e.textContent = n.toUpperCase(); }); }
  function knownLine(k) { if (!k) return ''; return k.channel_type === 'mobile' ? 'your number ' + k.masked : k.masked; }
  var ctx = { known: null, second: null, challenge: null };

  function showYes(known, second) {
    var box = $('[data-known]'); box.textContent = '';
    [known, second].filter(Boolean).forEach(function (k) { var p = document.createElement('p'); p.style.cssText = 'font-size:15px; line-height:21px; color:var(--ink);'; p.append('We’ll know you by '); var b = document.createElement('b'); b.style.fontWeight = '600'; b.textContent = knownLine(k); p.append(b, '.'); box.appendChild(p); });
    var offer = known && !second, mail = known && known.channel_type === 'email';
    $('[data-add]').hidden = !offer;
    if (offer) {
      $('[data-add-line]').textContent = mail ? 'Add your mobile too, in case your email changes one day.' : 'Add your email too, in case your number changes one day.';
      $('[data-add-mob]').hidden = !mail; $('[data-add-mail]').hidden = mail;
    }
    go('yes');
  }

  if (!R || !T) { go('gone'); return; }
  jvDoor('consent_view', { request_id: R, token: T }).then(function (res) {
    var b = res.body;
    if (res.status === 404) return go('gone');
    if (!(res.status === 200 && b.ok)) return trouble(res);
    named(b.owner_name || ''); ctx.known = b.known_by; ctx.second = b.second || null;
    if (b.state === 'pending') go('agree');
    else if (b.state === 'accepted') showYes(ctx.known, ctx.second);
    else if (b.state === 'declined') go('no');
    else go('expired');
  });

  function answer(decision, btn) {
    jvBusy(btn, true);
    jvDoor('consent_answer', { request_id: R, token: T, decision: decision }).then(function (res) {
      jvBusy(btn, false);
      if (res.status === 200 && res.body.ok) { if (decision === 'accept') { ctx.known = res.body.known_by || ctx.known; showYes(ctx.known, ctx.second); } else go('no'); }
      else if (res.status === 403 || res.status === 404) go('gone');
      else say($('[data-agree-err]'), jvTrouble(res));
    });
  }
  $('[data-yes]').addEventListener('click', function () { answer('accept', this); });
  $('[data-no]').addEventListener('click', function () { answer('decline', this); });

  // On yes: add the other way to reach them, checked with a code
  var addBtn = $('[data-add-btn]'), addErr = $('[data-add-err]'), addCode = $('[data-add-code]');
  addBtn.addEventListener('click', function () {
    var mail = ctx.known && ctx.known.channel_type === 'mobile';
    var dest = mail ? $('#rc-add-mail').value.trim() : window.jvMobile($('[data-add-mob] [data-mobile]'));
    if (!ctx.challenge) {
      if (mail ? !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(dest) : !/^\+\d{8,16}$/.test(dest)) { say(addErr, mail ? 'Check the email.' : 'Check the mobile number.'); return; }
      say(addErr, ''); jvBusy(addBtn, true);
      jvDoor('consent_add_start', { request_id: R, token: T, destination: dest }).then(function (res) {
        jvBusy(addBtn, false);
        if (res.status === 200 && res.body.ok) { ctx.challenge = res.body.challenge_id; ctx.dest = dest; addCode.hidden = false; addBtn.textContent = 'Add'; addCode.focus(); }
        else if (res.body.error === 'BAD_DESTINATION') say(addErr, mail ? 'Check the email.' : 'Check the mobile number.');
        else say(addErr, jvTrouble(res));
      });
    } else {
      var c = addCode.value.replace(/\s/g, ''); if (!c) { say(addErr, 'Type the code we sent you.'); return; }
      jvBusy(addBtn, true);
      jvDoor('consent_add_confirm', { request_id: R, token: T, challenge_id: ctx.challenge, code: c, destination: ctx.dest }).then(function (res) {
        jvBusy(addBtn, false); var b = res.body;
        if (res.status === 200 && b.ok && b.verified) { $('[data-add]').hidden = true; $('[data-added]').hidden = false; }
        else if (res.status === 200 && b.ok && b.verified === false) {
          if (b.too_many) { say(addErr, 'Too many tries. Ask for a new code.'); ctx.challenge = null; addCode.hidden = true; addCode.value = ''; addBtn.textContent = 'Send a code'; }
          else say(addErr, 'That code isn’t right. ' + (b.attempts_left != null ? b.attempts_left + (b.attempts_left === 1 ? ' try left.' : ' tries left.') : ''));
        } else say(addErr, jvTrouble(res));
      });
    }
  });
})();
