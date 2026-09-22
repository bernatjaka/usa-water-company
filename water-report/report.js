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
    PLACEHOLDER REPORT.
    Real per-market water data goes here once we agree the source.
    The market lookup is already live via booking.js.
  */
  function buildReport() {
    var name = fields[1].el.value.trim();
    var zip  = fields[2].el.value.trim();
    var key  = (typeof marketForZip === 'function') ? marketForZip(zip) : null;
    var covered = !!key;

    document.getElementById('r-zip').textContent = zip;
    document.getElementById('r-title').textContent = covered
      ? name + ', your water needs a closer look'
      : 'We do not cover ' + zip + ' yet';

    document.getElementById('r-sub').textContent = covered
      ? 'Based on what is typically found in ' + MARKETS[key].label + ' water. These are area figures, not a measurement of your tap. A free in-home test is the only way to know what is actually coming out of your faucet.'
      : 'We are not in your area yet, but call us on (480) 690-0600 and we will see what we can do.';

    var cards = document.getElementById('r-cards');
    cards.innerHTML = '';
    if (covered) {
      [
        { h: 'Water hardness',  v: 'Placeholder', p: 'Real figure for this area goes here.' , bad: true },
        { h: 'Chlorine',        v: 'Placeholder', p: 'Real figure for this area goes here.' },
        { h: 'Total dissolved solids', v: 'Placeholder', p: 'Real figure for this area goes here.' }
      ].forEach(function (c) {
        var d = document.createElement('div');
        d.className = 'card';
        d.innerHTML = '<h3>' + c.h + '</h3><div class="val' + (c.bad ? ' bad' : '') + '">' + c.v + '</div><p>' + c.p + '</p>';
        cards.appendChild(d);
      });
    }

    var cta = document.getElementById('r-cta');
    /* Keep whatever base path the markup already uses, this runs both on
       the standalone page and embedded on the homepage. */
    var base = (cta.getAttribute('href') || 'contact.html').split('?')[0];
    if (covered) {
      cta.textContent = 'Book My Free In-Home Test';
      cta.href = base + '?zip=' + encodeURIComponent(zip);
    } else {
      cta.textContent = 'Call (480) 690-0600';
      cta.href = 'tel:+14806900600';
    }

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

  /* Scenes light as they arrive, and the fixed canvas only shows while the
     block is on screen so it never floats over the rest of the page.
     Computed straight from scroll position, which is deterministic. */
  if (block) {
    var wrScenes = block.querySelectorAll('.wr-scene');

    /* Three rect reads, cheap enough to run straight off the scroll event.
       Deliberately not rAF throttled: a throttle flag that only clears
       inside the frame callback gets stuck whenever frames are paused. */
    function paintBlock() {
      var vh = window.innerHeight;
      var r = block.getBoundingClientRect();
      block.classList.toggle('active', r.bottom > 0 && r.top < vh);

      for (var i = 0; i < wrScenes.length; i++) {
        var sr = wrScenes[i].getBoundingClientRect();
        var mid = sr.top + sr.height / 2;          // lit while its middle
        wrScenes[i].classList.toggle('on',         // is inside the viewport
          mid > -vh * 0.15 && mid < vh * 1.15);
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
    modal.hidden = false;
    document.body.classList.add('wr-open');
    step = 1; showPanel(1); paintLines();
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('wr-open');
  }
  if (opener) opener.addEventListener('click', openModal);
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
