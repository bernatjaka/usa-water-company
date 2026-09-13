/*
  Market routing for the free water test booking.

  WHEN ROY AND RICK SEND THEIR CALENDLY LINKS, EDIT THE TWO URLS BELOW.
  That is the only change needed. Nothing else in the site has to move.
*/
var MARKETS = {
  phoenix: {
    label: 'Phoenix, AZ',
    url: 'https://calendly.com/craig-usawaterco/30min'      // Craig
  },
  'south-florida': {
    label: 'South Florida & Miami',
    url: 'https://calendly.com/craig-usawaterco/30min'      // TODO: Rick Toplak
  },
  orlando: {
    label: 'Orlando, FL',
    url: 'https://calendly.com/craig-usawaterco/30min'      // TODO: Roy
  }
};
var DEFAULT_MARKET = 'phoenix';

/* Tags the booking with its market so it is identifiable even while every
   market still shares one calendar. Shows up on the Calendly booking and
   carries through to the thank you page. */
function marketUrl(key) {
  var m = MARKETS[key] || MARKETS[DEFAULT_MARKET];
  return m.url + (m.url.indexOf('?') > -1 ? '&' : '?') + 'utm_content=' + encodeURIComponent(key);
}

/* Calendly's widget script is loaded async, so it is usually not ready yet
   when this runs. Wait for it rather than silently rendering nothing. */
function whenCalendlyReady(cb) {
  if (window.Calendly) { cb(); return; }
  var waited = 0;
  var t = setInterval(function () {
    waited += 100;
    if (window.Calendly) { clearInterval(t); cb(); }
    else if (waited >= 10000) { clearInterval(t); }
  }, 100);
}

function loadMarketCalendar(key, el) {
  if (!el) return;
  whenCalendlyReady(function () {
    el.innerHTML = '';
    Calendly.initInlineWidget({ url: marketUrl(key), parentElement: el });
  });
}

/* Contact page: buttons above the calendar swap which market is shown. */
function initMarketPicker() {
  var el = document.getElementById('booking-calendar');
  var btns = document.querySelectorAll('[data-market]');
  if (!el || !btns.length) return;

  function select(key) {
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('is-active', btns[i].getAttribute('data-market') === key);
    }
    loadMarketCalendar(key, el);
    try { sessionStorage.setItem('uwc-market', key); } catch (e) {}
  }

  for (var i = 0; i < btns.length; i++) {
    (function (b) {
      b.addEventListener('click', function () { select(b.getAttribute('data-market')); });
    })(btns[i]);
  }

  var start = el.getAttribute('data-market-default') || DEFAULT_MARKET;
  select(start);
}

/* City pages: market is already known, so load that calendar directly. */
function initSingleMarket() {
  var el = document.getElementById('market-calendar');
  if (!el) return;
  var key = el.getAttribute('data-market') || DEFAULT_MARKET;
  try { sessionStorage.setItem('uwc-market', key); } catch (e) {}
  loadMarketCalendar(key, el);
}

document.addEventListener('DOMContentLoaded', function () {
  initMarketPicker();
  initSingleMarket();
});
