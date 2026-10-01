// Runs before the page paints: applies the visitor's Light / Dark choice from the footer switch, if they made one.
// Stored in this browser only (localStorage); jeevanto.com sets no cookie.
(function () { try { var t = localStorage.getItem('jv-theme'); if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); } catch (e) {} })();
