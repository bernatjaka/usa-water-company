/*
  Summer sale bar. Hidden for the rest of the session once a visitor
  closes it, so it does not nag on every page they open.
  To retire the sale, delete the promobar markup or set SALE_ON to false.
*/
(function () {
  var SALE_ON = true;
  var KEY = 'uwc-promo-2950-dismissed';
  var bar = document.getElementById('promobar');
  if (!bar) return;
  if (!SALE_ON) { bar.hidden = true; return; }

  var dismissed = false;
  try { dismissed = localStorage.getItem(KEY) === '1'; } catch (e) {}
  if (dismissed) { bar.hidden = true; return; }

  bar.hidden = false;
  var close = document.getElementById('promobar-close');
  if (close) {
    close.addEventListener('click', function () {
      bar.hidden = true;
      try { localStorage.setItem(KEY, '1'); } catch (e) {}
    });
  }
})();
