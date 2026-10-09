// /connect/google: Google sends a person back here after they connect Gmail, Calendar or Contacts (cc-website-02).
// Runs before the page paints and hands the answer straight on to ENGINES' callback, which sends them back into the
// app. Only code, state, error and error_description go on, each exactly as Google wrote it; anything else is
// dropped. location.replace keeps the code out of the history. Nothing is read, stored, shown or logged.
(function () {
  var to = document.querySelector('meta[name="jv-callback"]').content; // from src/lib/engine.json, the one place
  var keep = { code: 1, state: 1, error: 1, error_description: 1 }, seen = {}, out = [];
  location.search.replace(/^\?/, '').split('&').forEach(function (part) {
    var k; try { k = decodeURIComponent(part.split('=')[0].replace(/\+/g, ' ')); } catch (e) { return; }
    if (keep[k] && !seen[k]) { seen[k] = 1; out.push(part); }
  });
  if (!out.length) return;
  document.documentElement.setAttribute('data-forwarding', '');
  location.replace(to + '?' + out.join('&'));
})();
