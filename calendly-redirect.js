/*
  Sends visitors to /thank-you/ after they finish booking on Calendly.
  Works for the inline embeds and for the popup opened by the hero form.
  Calendly posts a message to the parent window when a booking completes,
  so this listens for that message and moves the top window to the
  confirmation page. Any UTM or click id parameters already on the URL are
  carried over so ad platforms can attribute the conversion.
*/
(function () {
  var THANK_YOU_PATH = '/thank-you/';
  var redirected = false;

  function isCalendlyMessage(e) {
    return e.origin && e.origin.indexOf('calendly.com') > -1
      && e.data && typeof e.data.event === 'string'
      && e.data.event.indexOf('calendly.') === 0;
  }

  function lastSegment(uri) {
    if (!uri) return '';
    var parts = String(uri).split('/');
    return parts[parts.length - 1] || '';
  }

  function buildUrl(payload) {
    var params = new URLSearchParams(window.location.search);
    var invitee = lastSegment(payload && payload.invitee && payload.invitee.uri);
    var event = lastSegment(payload && payload.event && payload.event.uri);
    if (invitee) params.set('invitee', invitee);
    if (event) params.set('event', event);
    var query = params.toString();
    return THANK_YOU_PATH + (query ? '?' + query : '');
  }

  window.addEventListener('message', function (e) {
    if (!isCalendlyMessage(e)) return;
    if (e.data.event !== 'calendly.event_scheduled') return;
    if (redirected) return;
    redirected = true;
    window.location.href = buildUrl(e.data.payload);
  });
})();
