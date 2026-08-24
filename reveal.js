// Scroll-reveal with variety: each section animates a little differently, with staggered timing.
// Classes are added by JS only, so if JS is off or reduced-motion is set, nothing is hidden.
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;

  function reveal(el, effect, delay) {
    if (!el) return;
    el.classList.add('reveal', effect);
    if (delay) { el.style.transitionDelay = delay + 'ms'; }
  }

  // Apply an effect to each child of every matching container, with a stagger.
  function group(selector, effectFn, stagger) {
    document.querySelectorAll(selector).forEach(function (container) {
      Array.prototype.forEach.call(container.children, function (child, i) {
        reveal(child, effectFn(i), stagger ? i * stagger : 0);
      });
    });
  }

  // Headings gently rise
  document.querySelectorAll('.section-head').forEach(function (el) { reveal(el, 'reveal-up'); });

  // Service / review cards: alternate zoom and rise, staggered
  group('.cards', function (i) { return i % 2 ? 'reveal-up' : 'reveal-zoom'; }, 100);

  // "Our Systems" + product chooser: slide in from opposite sides
  group('.chooser-grid', function (i) { return i % 2 ? 'reveal-right' : 'reveal-left'; }, 120);

  // Region cards: alternate rotate-in and rise
  group('.region-grid', function (i) { return i % 2 ? 'reveal-up' : 'reveal-rotate'; }, 120);

  // How-it-works steps: sequential rise
  group('.steps', function () { return 'reveal-up'; }, 150);

  // Trust bar: soft fade, quick stagger
  group('.trustbar-inner', function () { return 'reveal-fade'; }, 90);

  // Two-column blocks: opposite sides, copy slightly delayed
  document.querySelectorAll('.featured').forEach(function (f) {
    reveal(f.querySelector('.featured-media'), 'reveal-left');
    reveal(f.querySelector('.featured-copy'), 'reveal-right', 120);
  });
  document.querySelectorAll('.loc-inner').forEach(function (f) {
    reveal(f.querySelector('.loc-copy'), 'reveal-left');
    reveal(f.querySelector('.loc-media'), 'reveal-right', 120);
  });
  document.querySelectorAll('.about-inner').forEach(function (f) {
    reveal(f.querySelector('.about-copy'), 'reveal-left');
    reveal(f.querySelector('.about-media'), 'reveal-right', 120);
  });
  document.querySelectorAll('.contact-inner').forEach(function (f) {
    reveal(f.querySelector('.contact-copy'), 'reveal-left');
    reveal(f.querySelector('.hero-card'), 'reveal-right', 120);
  });

  // Standalone figures / bands
  document.querySelectorAll('.diagram-figure').forEach(function (el) { reveal(el, 'reveal-zoom'); });
  document.querySelectorAll('.finishes').forEach(function (el) { reveal(el, 'reveal-up'); });
  document.querySelectorAll('.cta-band').forEach(function (el) { reveal(el, 'reveal-zoom'); });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      el.classList.add('is-visible');
      observer.unobserve(el);
      el.addEventListener('transitionend', function handler() {
        el.classList.remove('reveal', 'reveal-left', 'reveal-right', 'reveal-up',
          'reveal-down', 'reveal-zoom', 'reveal-rotate', 'reveal-fade', 'is-visible');
        el.style.transitionDelay = '';
        el.removeEventListener('transitionend', handler);
      });
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(function (el) { observer.observe(el); });
})();
