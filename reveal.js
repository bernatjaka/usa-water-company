// Scroll-reveal: elements slide/fade in from left, right, or up as they enter view.
// Classes are added by JS only, so if JS is off or reduced-motion is set, nothing is hidden.
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;

  function tag(el, dir) {
    if (el) { el.classList.add('reveal', dir); }
  }

  // Section headings and standalone figures fade up
  document.querySelectorAll('.section-head, .diagram-figure, .finishes, .cta-band')
    .forEach(function (el) { tag(el, 'reveal-up'); });

  // Grid children alternate left / right for a dynamic zig-zag
  ['.cards', '.chooser-grid', '.region-grid', '.product-grid', '.steps', '.trustbar-inner']
    .forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (grid) {
        Array.prototype.forEach.call(grid.children, function (child, i) {
          tag(child, i % 2 ? 'reveal-right' : 'reveal-left');
        });
      });
    });

  // Two-column blocks: text from one side, media from the other
  document.querySelectorAll('.featured').forEach(function (f) {
    tag(f.querySelector('.featured-media'), 'reveal-left');
    tag(f.querySelector('.featured-copy'), 'reveal-right');
  });
  document.querySelectorAll('.loc-inner').forEach(function (f) {
    tag(f.querySelector('.loc-copy'), 'reveal-left');
    tag(f.querySelector('.loc-media'), 'reveal-right');
  });
  document.querySelectorAll('.about-inner').forEach(function (f) {
    tag(f.querySelector('.about-copy'), 'reveal-left');
    tag(f.querySelector('.about-media'), 'reveal-right');
  });
  document.querySelectorAll('.contact-inner').forEach(function (f) {
    tag(f.querySelector('.contact-copy'), 'reveal-left');
    tag(f.querySelector('.hero-card'), 'reveal-right');
  });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      el.classList.add('is-visible');
      observer.unobserve(el);
      // After the animation, strip reveal classes so hover transitions work normally
      el.addEventListener('transitionend', function handler() {
        el.classList.remove('reveal', 'reveal-left', 'reveal-right', 'reveal-up', 'is-visible');
        el.removeEventListener('transitionend', handler);
      });
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(function (el) { observer.observe(el); });
})();
