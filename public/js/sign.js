// /sign-in and /create-account (decision 229; Cowork's rulings, 6 Oct): "Continue with Google" and "Continue with
// Apple" through Supabase Auth's own redirect, with no outside script. The session is ONE sign-in record in the
// browser's own storage (decision 231: "This website keeps one sign-in record in your browser, only if you sign in"):
// no cookie, nothing else stored, and Sign out clears it. The sign-in's tokens arrive in the address's #fragment,
// which is read once and wiped at once.
(function () {
  'use strict';
  var root = document.querySelector('[data-sign]'), meta = document.querySelector('meta[name="jv-engine"]');
  if (!root || !meta) return;
  var BASE = meta.getAttribute('content'), KEY = meta.getAttribute('data-key'), CREATE = root.getAttribute('data-sign') === 'create';
  var VERSION = root.getAttribute('data-legal-version');
  var STORE = 'jv-sign-in', session = null; // { access, refresh }: the one sign-in record
  function keep(s) { session = s; try { if (s) localStorage.setItem(STORE, JSON.stringify(s)); else localStorage.removeItem(STORE); } catch (e) {} }
  function kept() { try { var v = JSON.parse(localStorage.getItem(STORE) || 'null'); return v && v.access && v.refresh ? v : null; } catch (e) { return null; } }
  var $ = function (s) { return root.querySelector(s); }, err = $('[data-err]');
  function show(state) { window.jvShow(root, state); var h = root.querySelector('[data-state="' + state + '"] h1[tabindex]'); if (h) h.focus(); }
  function say(msg) { err.textContent = msg || ''; err.hidden = !msg; }
  function call(path, opts) {
    opts = opts || {};
    return fetch(BASE + path, {
      method: opts.method || 'POST', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + (session ? session.access : KEY) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j || {} }; }); },
      function () { return { status: 0, body: {} }; });
  }
  var TROUBLE = 'We couldn’t reach Jeevanto just now. Try again in a little while.';

  // 1 · the two doors: off to the company's own sign-in, back to this page
  root.querySelectorAll('[data-provider]').forEach(function (b) {
    b.addEventListener('click', function () {
      var back = location.origin + location.pathname;
      location.assign(BASE + '/auth/v1/authorize?provider=' + encodeURIComponent(b.getAttribute('data-provider')) + '&redirect_to=' + encodeURIComponent(back));
    });
  });

  // the buttons after signing in (attached before any early return below)
  $('[data-right]').addEventListener('click', function () { show('created'); });
  $('[data-here]').addEventListener('click', function () { signedIn(root.__profile); });
  $('[data-out]').addEventListener('click', function () {
    var b = this; window.jvBusy(b, true);
    call('/auth/v1/logout', {}).then(function () { window.jvBusy(b, false); keep(null); root.__profile = null; if (CREATE) { location.assign('/sign-in'); return; } show('ask'); say(''); });
  });

  // 2 · back from Google or Apple: read the fragment once, then wipe it from the address and the history
  var h = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (location.hash) history.replaceState(null, '', location.pathname);
  if (h.get('error')) { say(h.get('error') === 'access_denied' ? 'Signing in didn’t finish. You can try again.' : TROUBLE); return; }
  if (!h.get('access_token')) {
    // already signed in on this browser: check the record still works (refresh it once if it has run out)
    var was = kept(); if (!was) return;
    session = was; show('busy');
    call('/auth/v1/user', { method: 'GET' }).then(function (u) {
      if (u.status === 200) return u;
      return call('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: was.refresh } }).then(function (t) {
        if (t.status !== 200 || !t.body.access_token) throw t;
        keep({ access: t.body.access_token, refresh: t.body.refresh_token });
        return call('/auth/v1/user', { method: 'GET' });
      });
    }).then(function () { return profile(3); }).then(function (q) { return usable(q.display_name) ? signedIn(q) : askName(q, signedIn); })
      .catch(function () { keep(null); show('ask'); });
    return;
  }
  keep({ access: h.get('access_token'), refresh: h.get('refresh_token') });
  show('busy');

  function profile(tries) {
    return call('/functions/v1/account', { body: { action: 'get_profile' } }).then(function (r) {
      var p = r.body && (r.body.data || r.body);
      if (r.status === 200 && p && p.account_id) return p;
      if (tries > 0 && (r.status === 404 || r.status === 200)) return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () { return profile(tries - 1); });
      throw r;
    });
  }
  call('/auth/v1/user', { method: 'GET' }).then(function (u) {
    if (u.status !== 200) throw u;
    var created = Date.parse(u.body.created_at), last = Date.parse(u.body.last_sign_in_at);
    var isNew = Math.abs(last - created) < 60000; // as the app tells them apart (CreateAccountScreen: created_at === last_sign_in_at)
    return profile(6).then(function (p) {
      if (!isNew) return usable(p.display_name) ? signedIn(p) : askName(p, signedIn);
      // a first sign-in records which Terms and Privacy policy this page showed (decision 204; ENGINES' agreement door)
      return call('/functions/v1/account/agreement', { body: { terms_version: VERSION, privacy_version: VERSION } }).then(function (a) {
        if (a.status === 409) { keep(null); show('ask'); say('Our Terms of use or Privacy policy changed just now. Reload this page, read them, and try again.'); return; }
        if (a.status !== 200) throw a;
        usable(p.display_name) ? review(p) : askName(p, review);
      });
    });
  }).catch(function () { keep(null); show('ask'); say(TROUBLE); });

  // a name the page may show: has letters and is never an address (an Apple relay email once showed as the name, 9 Oct)
  function usable(n) { n = String(n || '').trim(); return /\p{L}/u.test(n) && n.indexOf('@') < 0 ? n : ''; }
  // no usable name from the provider: ask (the sign-up's own step-3 words), save it with the person's own session to
  // the sign-in record's display_name; the server's trigger copies it to the account (never a value with "@")
  function askName(p, then) {
    var f = root.querySelector('[data-state="name"]'), err = f.querySelector('[data-name-err]');
    f.onsubmit = function (e) {
      e.preventDefault();
      var first = usable(document.getElementById('sg-first').value), last = usable(document.getElementById('sg-last').value);
      if (!first) { err.textContent = 'Type your first name.'; err.hidden = false; return; }
      err.hidden = true; var b = f.querySelector('[data-name-go]'); window.jvBusy(b, true);
      var name = last ? first + ' ' + last : first;
      call('/auth/v1/user', { method: 'PUT', body: { data: { display_name: name } } }).then(function (r) {
        if (r.status !== 200) throw r;
        return (function wait(n) { return profile(3).then(function (q) { return usable(q.display_name) || n <= 0 ? q : new Promise(function (ok) { setTimeout(ok, 1000); }).then(function () { return wait(n - 1); }); }); })(5);
      }).then(function (q) { window.jvBusy(b, false); if (!usable(q.display_name)) q.display_name = name; then(q); })
        .catch(function () { window.jvBusy(b, false); err.textContent = TROUBLE; err.hidden = false; });
    };
    show('name');
  }
  function firstName(p) { var n = usable(p.display_name); return n ? n.split(/\s+/)[0] : ''; }
  // 4 · who you are, as we have it (the 30 Sep words; with Google or Apple: the name, and the email, verified)
  function review(p) {
    var mail = (p.channels || []).filter(function (c) { return c.channel_type === 'email'; })[0];
    var rows = [['Name', usable(p.display_name), '']];
    if (mail) rows.push(['Email', mail.destination, mail.verified ? 'verified' : 'not verified']);
    var box = $('[data-rows]'); box.textContent = '';
    rows.forEach(function (r, i) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:12px; padding:13px 0; border-bottom:' + (i === rows.length - 1 ? 'none' : '1px solid var(--line)') + ';';
      var left = document.createElement('div'); left.style.cssText = 'display:flex; flex-direction:column; gap:2px; min-width:0;';
      var k = document.createElement('span'); k.style.cssText = 'font-size:13px; color:var(--quiet);'; k.textContent = r[0];
      var v = document.createElement('span'); v.style.cssText = 'font-size:15px; font-weight:600; color:var(--ink); overflow-wrap:anywhere;'; v.textContent = r[1];
      left.append(k, v); row.append(left);
      if (r[2]) { var m = document.createElement('span'); m.style.cssText = 'flex:none; font-size:13px; color:' + (r[2] === 'verified' ? 'var(--sage)' : 'var(--quiet)') + ';'; m.textContent = r[2]; row.append(m); }
      box.append(row);
    });
    root.__profile = p; show('review');
  }
  // an existing account, or "Or continue here" until /account is built (Cowork's ruling 2)
  function signedIn(p) {
    var n = firstName(p || {});
    $('[data-signed-in]').textContent = n ? 'You’re signed in as ' + n + '.' : 'You’re signed in.';
    show('in');
  }
})();
