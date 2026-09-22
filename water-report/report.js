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

  var fields = {
    1: { el: document.getElementById('f-name'),  label: 'name'  },
    2: { el: document.getElementById('f-zip'),   label: 'zip'   },
    3: { el: document.getElementById('f-email'), label: 'email' }
  };

  var step = 0;          // 0 title, 1 to 3 questions, 4 building, 5 report
  var LAST_QUESTION = 3;

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

  function showPanel(n) {
    Object.keys(panels).forEach(function (k) { panels[k].classList.remove('is-on'); });
    var group = (n >= 1 && n <= LAST_QUESTION) ? '1' : String(n);
    panels[group].classList.add('is-on');
  }

  function paintLines() {
    lines.forEach(function (line) {
      var n = Number(line.getAttribute('data-line'));
      line.classList.toggle('show', n <= step);
      line.classList.toggle('done', n < step);
    });
    prev.hidden = (step <= 1);
    next.textContent = (step === LAST_QUESTION) ? 'Get My Report' : 'Next';
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
    if (f.label === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { return 'Please enter a valid email address.'; }
    }
    return true;
  }

  function advance() {
    var check = validate();
    if (check !== true) { err.textContent = check; fields[step].el.focus(); return; }
    err.textContent = '';
    if (step < LAST_QUESTION) { step++; paintLines(); return; }
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

    if (!data) {
      titleEl.textContent = 'We do not cover ' + zip + ' yet';
      subEl.textContent = 'We are not in your area yet. Call us on (480) 690-0600 and we will see what we can do.';
      cta.textContent = 'Call (480) 690-0600';
      cta.href = 'tel:+14806900600';
      step = 5; showPanel(5);
      return;
    }

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
    var gate = document.getElementById('r-gate');
    if (gate) {
      gate.hidden = hidden <= 0;
      var gt = document.getElementById('r-gate-title');
      var gs = document.getElementById('r-gate-sub');
      if (gt) gt.textContent = hidden + ' more result' + (hidden === 1 ? '' : 's') + ' in your area';
      if (gs) gs.textContent =
        'Your full report, and a test of the water actually coming out of your taps, is done in person by a certified technician. It is free and takes about an hour.';
    }

    var base = (cta.getAttribute('href') || 'contact.html').split('?')[0];
    if (base.indexOf('tel:') === 0) base = 'contact.html';
    cta.textContent = 'Pick a Time for My Free Test';
    cta.href = base + '?zip=' + encodeURIComponent(zip);

    try {
      sessionStorage.setItem('uwc-zip', zip);
      if (key) sessionStorage.setItem('uwc-market', key);
    } catch (e) {}

    step = 5; showPanel(5);
  }

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

    /* Keep the captions clear of the site's sticky header. */
    var siteHeader = document.querySelector('.header');
    function setHeaderOffset() {
      var h = siteHeader ? siteHeader.getBoundingClientRect().height : 0;
      block.style.setProperty('--wrHeader', Math.round(h) + 'px');
    }
    setHeaderOffset();
    window.addEventListener('resize', setHeaderOffset);

    function paintBlock() {
      var vh = window.innerHeight;
      var r = block.getBoundingClientRect();

      /* Show while the block covers most of the screen. Using coverage
         rather than "top <= 0" avoids a blank strip on first paint, when
         the header still sits above the block. */
      var covered = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      var owns = covered >= vh * 0.75;
      block.classList.toggle('active', owns);

      var span = Math.max(1, r.height - vh);
      var p = Math.min(1, Math.max(0, -r.top / span));
      var idx = p < 0.34 ? 1 : (p < 0.68 ? 2 : 3);

      for (var i = 0; i < wrScenes.length; i++) {
        wrScenes[i].classList.toggle('on',
          owns && Number(wrScenes[i].getAttribute('data-wr')) === idx);
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
