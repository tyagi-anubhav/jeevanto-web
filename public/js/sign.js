// /sign-in and /create-account (decision 229; Cowork's rulings, 6 Oct): "Continue with Google" and "Continue with
// Apple" through Supabase Auth's own redirect, with no outside script. The session is kept ONLY in this page's memory
// until the founder rules on the policy's cookie line (Cowork's ruling 3), so nothing is written to the browser: a
// reload is signed out. The sign-in's tokens arrive in the address's #fragment, which is read once and wiped at once.
(function () {
  'use strict';
  var root = document.querySelector('[data-sign]'), meta = document.querySelector('meta[name="jv-engine"]');
  if (!root || !meta) return;
  var BASE = meta.getAttribute('content'), KEY = meta.getAttribute('data-key'), CREATE = root.getAttribute('data-sign') === 'create';
  var VERSION = root.getAttribute('data-legal-version');
  var session = null; // { access, refresh }: memory only
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

  // 2 · back from Google or Apple: read the fragment once, then wipe it from the address and the history
  var h = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (location.hash) history.replaceState(null, '', location.pathname);
  if (h.get('error')) { say(h.get('error') === 'access_denied' ? 'Signing in didn’t finish. You can try again.' : TROUBLE); return; }
  if (!h.get('access_token')) return;
  session = { access: h.get('access_token'), refresh: h.get('refresh_token') };
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
      if (!isNew) return signedIn(p);
      // a first sign-in records which Terms and Privacy policy this page showed (decision 204; ENGINES' agreement door)
      return call('/functions/v1/account/agreement', { body: { terms_version: VERSION, privacy_version: VERSION } }).then(function (a) {
        if (a.status === 409) { session = null; show('ask'); say('Our Terms of use or Privacy policy changed just now. Reload this page, read them, and try again.'); return; }
        if (a.status !== 200) throw a;
        review(p);
      });
    });
  }).catch(function () { session = null; show('ask'); say(TROUBLE); });

  function firstName(p) { var n = String(p.display_name || '').trim(); return n && n.indexOf('@') < 0 ? n.split(/\s+/)[0] : ''; }
  // 4 · who you are, as we have it (the 30 Sep words; with Google or Apple: the name, and the email, verified)
  function review(p) {
    var mail = (p.channels || []).filter(function (c) { return c.channel_type === 'email'; })[0];
    var rows = [['Name', String(p.display_name || '').trim(), '']];
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
  $('[data-right]').addEventListener('click', function () { show('created'); });
  $('[data-here]').addEventListener('click', function () { signedIn(root.__profile); });
  // an existing account, or "Or continue here" until /account is built (Cowork's ruling 2)
  function signedIn(p) {
    var n = firstName(p || {});
    $('[data-signed-in]').textContent = n ? 'You’re signed in as ' + n + '.' : 'You’re signed in.';
    show('in');
  }
  $('[data-out]').addEventListener('click', function () {
    var b = this; window.jvBusy(b, true);
    call('/auth/v1/logout', {}).then(function () { window.jvBusy(b, false); session = null; root.__profile = null; show('ask'); say(''); });
  });
})();
