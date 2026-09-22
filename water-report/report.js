/*
  The Water Report flow.

  Steps 1 to 3 build one sentence, a line at a time, then a placeholder
  report renders. The report content is deliberately stubbed for now,
  see buildReport() below, but the zip already picks the right market so
  the booking button lands on the correct team's calendar.
*/
(function () {
  var panels = {};
  document.querySelectorAll('[data-panel]').forEach(function (el) {
    panels[el.getAttribute('data-panel')] = el;
  });

  var ink      = document.getElementById('ink');   // standalone only, optional
  var stage    = document.getElementById('stage');
  var scroller = document.getElementById('scroller');

  /* Embedded on the homepage */
  var block  = document.getElementById('wr-block');
  var modal  = document.getElementById('wr-modal');
  var opener = document.getElementById('wr-open');
  var closer = document.getElementById('wr-close');
  var err   = document.getElementById('err');
  var fine  = document.getElementById('fine');
  var prev  = document.getElementById('prev');
  var next  = document.getElementById('next');
  var lines = document.querySelectorAll('.line');

  /* Name and zip only. No email gate: the report is the thing that sells
     the visit, so putting a field in front of it just loses people. An
     optional copy by email is offered after they have seen it. */
  var fields = {
    1: { el: document.getElementById('f-name'), label: 'name' },
    2: { el: document.getElementById('f-zip'),  label: 'zip'  }
  };

  var step = 0;          // 0 title, 1 to 3 questions, 4 building, 5 report
  var LAST_QUESTION = 2;

  /* Inputs grow with their contents so the sentence stays tight. */
  function autosize(input) {
    var v = input.value || input.placeholder || '';
    input.style.width = Math.max(6, Math.min(v.length + 1, 22)) + 'ch';
  }
  Object.keys(fields).forEach(function (k) {
    var input = fields[k].el;
    autosize(input);
    input.addEventListener('input', function () {
      autosize(input);
      err.textContent = '';
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); advance(); }
    });
  });

  var stickyBar = document.getElementById('wr-stickycta');

  function showPanel(n) {
    Object.keys(panels).forEach(function (k) { panels[k].classList.remove('is-on'); });
    var group = (n >= 1 && n <= LAST_QUESTION) ? '1' : String(n);
    if (panels[group]) panels[group].classList.add('is-on');
    /* the ask follows the report, and gets out of the way on the calendar */
    if (stickyBar) stickyBar.hidden = (n !== 5) || !stickyAllowed;
  }
  var stickyAllowed = false;

  function paintLines() {
    lines.forEach(function (line) {
      var n = Number(line.getAttribute('data-line'));
      line.classList.toggle('show', n <= step);
      line.classList.toggle('done', n < step);
    });
    prev.hidden = (step <= 1);
    next.textContent = (step === LAST_QUESTION) ? 'Show My Results' : 'Next';
    fine.style.visibility = (step === LAST_QUESTION) ? 'visible' : 'hidden';
    var f = fields[step];
    if (f) { setTimeout(function () { f.el.focus(); }, 340); }
  }

  function validate() {
    var f = fields[step];
    if (!f) return true;
    var v = (f.el.value || '').trim();
    if (f.label === 'name') {
      if (v.length < 2) { return 'Please enter your first name.'; }
    }
    if (f.label === 'zip') {
      if (!/^\d{5}$/.test(v)) { return 'Please enter a 5 digit zip code.'; }
    }
    return true;
  }

  function advance() {
    var check = validate();
    if (check !== true) { err.textContent = check; fields[step].el.focus(); return; }
    err.textContent = '';
    if (step < LAST_QUESTION) {
      /* zip already supplied on the prompt, so skip straight to results */
      var zipEl = fields[2] && fields[2].el;
      if (step === 1 && zipEl && /^\d{5}$/.test((zipEl.value || '').trim())) {
        runBuild(); return;
      }
      step++; paintLines(); return;
    }
    runBuild();
  }

  function goBack() {
    if (step <= 1) return;
    step--; err.textContent = ''; paintLines();
  }

  /* Short build sequence, enough to feel like work happened. */
  function runBuild() {
    var zip = fields[2].el.value.trim();
    document.getElementById('b-zip').textContent = zip;
    step = 4; showPanel(4);
    if (ink) ink.classList.add('shift');
    var fill = document.getElementById('barfill');
    fill.style.width = '0';
    requestAnimationFrame(function () {
      fill.style.transition = 'width 1.9s cubic-bezier(.4,.1,.2,1)';
      fill.style.width = '100%';
    });
    setTimeout(buildReport, 2100);
  }

  /*
    The report. A quarter of it is open, the rest is held back until they
    book, which is the whole point: the free test is what unlocks it.
  */
  function fmt(n) {
    if (n >= 100) return Math.round(n).toLocaleString();
    if (n >= 10)  return n.toFixed(1);
    return n.toFixed(1);
  }

  function contaminantCard(c, locked) {
    var times = timesOver(c);
    var el = document.createElement('div');
    el.className = 'wr-card' + (locked ? ' is-locked' : '');
    el.innerHTML =
      '<h3>' + c.name + '</h3>' +
      '<p class="wr-card-lead">Your water contains</p>' +
      '<div class="wr-card-times">' + fmt(times) + ' times</div>' +
      '<p class="wr-card-lead">the recommended health guideline</p>' +
      '<dl class="wr-card-rows">' +
        '<div><dt>This utility</dt><dd>' + c.level + ' ' + c.unit + '</dd></div>' +
        '<div><dt>EWG health guideline</dt><dd>' + c.guideline + ' ' + c.unit + '</dd></div>' +
        '<div><dt>Legal limit</dt><dd>' +
          (c.legal === null ? 'No legal limit' : c.legal + ' ' + c.unit) + '</dd></div>' +
      '</dl>';
    return el;
  }

  function buildReport() {
    var name = (fields[1].el.value || '').trim();
    var zip  = (fields[2].el.value || '').trim();
    var key  = (typeof marketForZip === 'function') ? marketForZip(zip) : null;
    var data = key && typeof WATER_DATA !== 'undefined' ? WATER_DATA[key] : null;

    var titleEl = document.getElementById('r-title');
    var subEl   = document.getElementById('r-sub');
    var cards   = document.getElementById('r-cards');
    var cta     = document.getElementById('r-cta');
    var zipEl   = document.getElementById('r-zip');
    if (zipEl) zipEl.textContent = zip;
    cards.innerHTML = '';

    var copyTo = document.querySelector('.wr-copyto');
    var gate = document.getElementById('r-gate');

    if (!data) {
      /* Outside the service area. Still a lead, so never a dead end. */
      titleEl.innerHTML = 'We are not in <span class="wr-accent">' + zip + '</span> yet';
      subEl.textContent = 'We cover the Phoenix, South Florida and Orlando metros today, and we are opening new areas. Give us a call and we will tell you where we are heading next.';
      if (copyTo) copyTo.hidden = true;
      if (gate) {
        gate.hidden = false;
        var gt0 = document.getElementById('r-gate-title');
        var gs0 = document.getElementById('r-gate-sub');
        if (gt0) gt0.textContent = 'Tell us where you are';
        if (gs0) gs0.textContent = 'If we are coming to your area we will let you know, and if a neighbour of yours is already asking, that moves you up the list.';
        var list0 = gate.querySelector('.wr-gate-list');
        if (list0) list0.hidden = true;
        if (vidWrap) vidWrap.hidden = true;     /* no visit to explain */
      }
      cta.textContent = 'Call (480) 690-0600';
      cta.onclick = function () { window.location.href = 'tel:+14806900600'; };
      stickyAllowed = false;
      step = 5; showPanel(5);
      return;
    }
    if (copyTo) copyTo.hidden = false;
    var listBack = document.querySelector('.wr-gate-list');
    if (listBack) listBack.hidden = false;
    if (vidWrap) vidWrap.hidden = false;

    var over = data.contaminants
      .filter(function (c) { return timesOver(c) > 1; })
      .sort(function (a2, b2) { return timesOver(b2) - timesOver(a2); });
    var list = over.length ? over : data.contaminants.slice();

    var first = name ? name.split(' ')[0] : 'there';
    titleEl.innerHTML = first + ', here is what is in<br /><span class="wr-accent">' + zip + '</span> tap water';
    subEl.innerHTML = 'Measured by ' + data.utility + ' and published by the ' + data.source +
      '. These are figures for the water supplied to your area, not a test of your own tap.';

    var shown = Math.max(1, Math.min(WATER_FREE_COUNT, list.length));
    for (var i = 0; i < list.length; i++) {
      cards.appendChild(contaminantCard(list[i], i >= shown));
    }

    /* the gate */
    var hidden = list.length - shown;
    if (gate) {
      gate.hidden = hidden <= 0;
      var gt = document.getElementById('r-gate-title');
      var gs = document.getElementById('r-gate-sub');
      if (gt) gt.textContent = hidden + ' more result' + (hidden === 1 ? '' : 's') + ' in your area';
      if (gs) gs.textContent =
        'Your full report, and a test of the water actually coming out of your taps, is done in person by a certified technician. It is free and takes about an hour.';
    }

    cta.textContent = 'Pick a Time for My Free Test';
    cta.onclick = null;
    stickyAllowed = true;
    var st = document.getElementById('wr-sticky-text');
    if (st) st.textContent = hidden + ' more result' + (hidden === 1 ? '' : 's') + ' unlock with your free test';

    try {
      sessionStorage.setItem('uwc-zip', zip);
      if (key) sessionStorage.setItem('uwc-market', key);
    } catch (e) {}

    step = 5; showPanel(5);
  }

  /* Optional copy by email, offered only once the report is on screen. */
  var mailBtn = document.getElementById('wr-mailme');
  var mailForm = document.getElementById('wr-mailform');
  var mailOk = document.getElementById('wr-mailok');
  if (mailBtn && mailForm) {
    mailBtn.addEventListener('click', function () {
      mailForm.hidden = false;
      mailBtn.hidden = true;
      var i = document.getElementById('wr-mailinput');
      if (i) i.focus();
    });
    mailForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var i = document.getElementById('wr-mailinput');
      var v = (i && i.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { i.focus(); return; }
      /* TODO: wire to the mail service once one is chosen */
      mailForm.hidden = true;
      if (mailOk) mailOk.hidden = false;
    });
  }

  /* The player is only fetched if someone actually presses play, so the
     report stays fast for everyone who does not. */
  var vidWrap = document.getElementById('r-video');
  var vidPlay = document.getElementById('r-video-play');
  if (vidPlay && vidWrap) {
    vidPlay.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = 'https://player.vimeo.com/video/1229323914' +
              '?autoplay=1&title=0&byline=0&portrait=0&dnt=1';
      f.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
      f.setAttribute('allowfullscreen', '');
      f.setAttribute('title', 'What happens at your free water test');
      vidWrap.innerHTML = '';
      vidWrap.appendChild(f);
    });
  }

  /* Assume the sale: the report hands straight to a calendar, in place. */
  var calLoaded = false;
  function showBooking() {
    var zip = (fields[2].el.value || '').trim();
    var key = (typeof marketForZip === 'function') ? marketForZip(zip) : null;
    if (!key) { window.location.href = 'tel:+14806900600'; return; }

    var sub = document.getElementById('b-sub');
    if (sub && typeof MARKETS !== 'undefined' && MARKETS[key]) {
      sub.textContent = 'A certified technician from our ' + MARKETS[key].label +
        ' team tests the water at your own taps and walks you through the full results. ' +
        'Free, about an hour, no obligation.';
    }

    var el = document.getElementById('wr-cal');
    if (el && !calLoaded && typeof loadMarketCalendar === 'function') {
      loadMarketCalendar(key, el);
      calLoaded = true;
    }
    step = 6; showPanel(6);
    var body = document.querySelector('.wr-modal-body');
    if (body) body.scrollTop = 0;
  }

  var ctaBtn = document.getElementById('r-cta');
  if (ctaBtn) ctaBtn.addEventListener('click', showBooking);
  var stickyBtn = document.getElementById('wr-sticky-btn');
  if (stickyBtn) stickyBtn.addEventListener('click', showBooking);
  var backBtn = document.getElementById('wr-backtoreport');
  if (backBtn) backBtn.addEventListener('click', function () { step = 5; showPanel(5); });

  next.addEventListener('click', advance);
  prev.addEventListener('click', goBack);
  /* ---- Scroll narrative ---- */

  /* Ink position and scale track scroll progress through the intro. */
  var ticking = false;
  function onScroll() {
    if (!scroller) return;
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var max = Math.max(1, scroller.offsetHeight - window.innerHeight);
      var p = Math.min(1, Math.max(0, window.scrollY / max));
      if (ink) ink.style.setProperty('--p', p.toFixed(4));
      if (window.WaterSystem) window.WaterSystem.set(p);
      ticking = false;
    });
  }

  /* Each scene fades up as it enters, and stays lit once seen. */
  var scenes = document.querySelectorAll('.scene');   // standalone page only
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) e.target.classList.add('lit');
      });
    }, { threshold: 0.35 });
    scenes.forEach(function (sc) { io.observe(sc); });
  } else {
    scenes.forEach(function (sc) { sc.classList.add('lit'); });
  }

  /* The pinned layer is only shown while the block fills the whole
     viewport, so it can never overlap the nav above or the hero below.
     Scroll through the block picks exactly one caption. */
  if (block) {
    var wrScenes = block.querySelectorAll('.wr-scene');

    /* Keep the captions clear of whatever is above them. At the top of the
       page that is the promo bar, top bar and header together; once scrolled
       it is just the sticky header. Recomputed as you scroll so the copy is
       never clipped. */
    var siteHeader = document.querySelector('.header');
    function headerOffset(rTop) {
      var h = siteHeader ? siteHeader.getBoundingClientRect().height : 0;
      return Math.max(h, Math.max(0, rTop || 0));
    }

    var pin = block.querySelector('.wr-pin');
    var ask = document.getElementById('wr-ask');

    function paintBlock() {
      var vh = window.innerHeight;
      var r = block.getBoundingClientRect();

      /* How much of the screen the section still owns, 0 to 1. */
      block.style.setProperty('--wrHeader', Math.round(headerOffset(r.top)) + 'px');

      var covered = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      var ratio = Math.max(0, Math.min(1, covered / vh));

      /* Stay mounted until it has almost gone, and fade with the ratio so
         the scene dissolves into the next section instead of cutting. */
      var owns = ratio > 0.04;
      block.classList.toggle('active', owns);
      if (pin) {
        var fade = Math.max(0, Math.min(1, (ratio - 0.04) / 0.42));
        pin.style.opacity = fade.toFixed(3);
        pin.style.setProperty('--wrLift', ((1 - fade) * -26).toFixed(1) + 'px');
      }

      /* On phones the scene sits under the copy, so tell it where the copy
         actually ends instead of hoping a fixed fraction clears it. */
      if (window.WaterSystem && window.WaterSystem.setTop) {
        if (window.innerWidth <= 900) {
          var txt = block.querySelector('.wr-scene.on .wr-txt');
          window.WaterSystem.setTop(txt ? txt.getBoundingClientRect().bottom + 22 : 0);
        } else {
          window.WaterSystem.setTop(0);
        }
      }

      /* the prompt underneath rises in as the scene goes */
      if (ask) {
        var ar = ask.getBoundingClientRect();
        ask.classList.toggle('lit', ar.top < vh * 0.85 && ar.bottom > 0);
      }

      var span = Math.max(1, r.height - vh);
      var p = Math.min(1, Math.max(0, -r.top / span));
      var idx = p < 0.34 ? 1 : (p < 0.68 ? 2 : 3);

      for (var i = 0; i < wrScenes.length; i++) {
        wrScenes[i].classList.toggle('on',
          ratio > 0.55 && Number(wrScenes[i].getAttribute('data-wr')) === idx);
      }
    }

    window.addEventListener('scroll', paintBlock, { passive: true });
    window.addEventListener('resize', paintBlock);
    paintBlock();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* Handing over from the narrative to the quiz. */
  function openModal() {
    /* carry over the zip if they already typed it on the prompt */
    var ask = document.getElementById('ask-zip');
    var note = document.getElementById('ask-note');
    if (ask) {
      var z = (ask.value || '').trim();
      if (z) {
        if (!/^\d{5}$/.test(z)) {
          if (note) note.textContent = 'Please enter a 5 digit zip code.';
          ask.focus();
          return;
        }
        if (fields[2] && fields[2].el) {
          fields[2].el.value = z;
          autosize(fields[2].el);
        }
      }
      if (note) note.textContent = '';
    }
    modal.hidden = false;
    document.body.classList.add('wr-open');
    step = 1; showPanel(1); paintLines();
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('wr-open');
  }
  if (opener) opener.addEventListener('click', openModal);
  var askZip = document.getElementById('ask-zip');
  if (askZip) {
    askZip.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); openModal(); }
    });
    askZip.addEventListener('input', function () {
      var n = document.getElementById('ask-note');
      if (n) n.textContent = '';
    });
  }
  if (closer) closer.addEventListener('click', closeModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal && !modal.hidden) closeModal();
  });

  function openQuiz() {
    if (!stage) return;
    document.body.classList.add('quiz-on');
    stage.hidden = false;
    step = 1; showPanel(1); paintLines();
    window.scrollTo(0, 0);
    if (ink) ink.style.setProperty('--p', '1');
    if (window.WaterSystem) window.WaterSystem.set(1);
  }

  document.querySelectorAll('[data-go]').forEach(function (b) {
    b.addEventListener('click', openQuiz);
  });

  requestAnimationFrame(function () {
    if (ink) ink.classList.add('in');
    var sys = document.getElementById('sys');
    if (sys) sys.classList.add('in');
  });
})();
