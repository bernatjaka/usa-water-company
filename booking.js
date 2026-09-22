/*
  Market routing for the free water test booking.

  WHEN ROY AND RICK SEND THEIR CALENDLY LINKS, EDIT THE TWO URLS BELOW.
  That is the only change needed. Nothing else in the site has to move.
*/
var MARKETS = {
  phoenix: {
    label: 'Phoenix, AZ',
    url: 'https://calendly.com/d/dv9n-zgw-rp8/phoenix-free-water-test'   // Craig, round robin
  },
  'south-florida': {
    label: 'South Florida & Miami',
    url: 'https://calendly.com/d/dz66-7h6-fht/south-florida-free-water-test'  // Rick Toplak
  },
  orlando: {
    label: 'Orlando, FL',
    url: 'https://calendly.com/d/dvwy-6hj-3jp/orlando-free-water-test'      // LeRoy Henderson
  }
};
var DEFAULT_MARKET = 'phoenix';

/*
  Zip code routing. A visitor types their zip and we send them to the team
  that covers it. Matched on the first 3 digits.
  To add a territory later, add its prefixes to the right list.
*/
var ZIP_PREFIXES = {
  phoenix: ['850', '851', '852', '853'],                 // Phoenix metro, Maricopa County
  'south-florida': ['330', '331', '332', '333', '334',   // Miami-Dade, Broward, Palm Beach
                    '339', '341'],                       // Fort Myers, Cape Coral, Naples
  orlando: ['327', '328', '329', '347']                  // Orlando metro, Kissimmee, Space Coast
};

/* Returns a market key, or null when we do not cover that zip. */
function marketForZip(zip) {
  var digits = String(zip || '').replace(/[^0-9]/g, '');
  if (digits.length < 5) return null;
  var prefix = digits.slice(0, 3);
  for (var key in ZIP_PREFIXES) {
    if (ZIP_PREFIXES[key].indexOf(prefix) > -1) return key;
  }
  return null;
}

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

/* Contact and home pages: visitor enters a zip, we load the team that covers it. */
function initZipRouter() {
  var el = document.getElementById('booking-calendar');
  var form = document.getElementById('zip-form');
  if (!el || !form) return;

  var input = document.getElementById('zip-input');
  var status = document.getElementById('zip-status');
  var picker = document.getElementById('market-fallback');

  function show(key, zip) {
    status.className = 'zip-status is-found';
    status.textContent = 'Showing availability for ' + MARKETS[key].label + '.';
    el.hidden = false;
    loadMarketCalendar(key, el);
    try { sessionStorage.setItem('uwc-market', key); } catch (e) {}
    if (zip) { try { sessionStorage.setItem('uwc-zip', zip); } catch (e) {} }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var zip = (input.value || '').trim();
    var key = marketForZip(zip);
    if (key) {
      show(key, zip);
      if (picker) picker.hidden = true;
      return;
    }
    if (String(zip).replace(/[^0-9]/g, '').length < 5) {
      status.className = 'zip-status is-error';
      status.textContent = 'Please enter a 5 digit zip code.';
      return;
    }
    /* Outside the areas we cover. Do not hide the calendar entirely, someone
       may still be worth booking, but be honest that it is outside the zone. */
    status.className = 'zip-status is-error';
    status.innerHTML = 'We do not have a team in ' + zip + ' yet. Call <a href="tel:+14806900600">(480) 690-0600</a> and we will see what we can do, or pick the closest area below.';
    if (picker) picker.hidden = false;
  });

  /* Fallback buttons, shown when a zip is not covered or the visitor asks to change area. */
  var btns = document.querySelectorAll('[data-market]');
  for (var i = 0; i < btns.length; i++) {
    (function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-market');
        for (var j = 0; j < btns.length; j++) {
          btns[j].classList.toggle('is-active', btns[j] === b);
        }
        show(key, '');
      });
    })(btns[i]);
  }

  /* Arriving from the water report with a zip already known, skip the retype. */
  var fromReport = (new URLSearchParams(window.location.search)).get('zip');
  if (!fromReport) { try { fromReport = sessionStorage.getItem('uwc-zip'); } catch (e) {} }
  if (fromReport) {
    var preKey = marketForZip(fromReport);
    if (preKey) { input.value = fromReport; show(preKey, fromReport); }
  }

  var change = document.getElementById('zip-change');
  if (change) {
    change.addEventListener('click', function (e) {
      e.preventDefault();
      if (picker) picker.hidden = false;
    });
  }
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
  initZipRouter();
  initSingleMarket();
});
