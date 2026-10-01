// Runs before the page paints. Dark unless the visitor chose otherwise in the footer switch (founder, 1 Oct: the app
// is dark only in V1). "device" follows the visitor's own setting. Kept in this browser only; jeevanto.com sets no cookie.
(function () { try { var t = localStorage.getItem('jv-theme'); if (t === 'light' || t === 'dark' || t === 'device') document.documentElement.setAttribute('data-theme', t); } catch (e) {} })();
