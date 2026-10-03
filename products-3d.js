/*
  Interactive 3D cutaway of the Black Diamond carbon filter.

  The model is built in code rather than loaded from a file, so there is nothing
  to export from a 3D package and nothing to keep in sync. Every part it shows is
  a real part of the tank.

  Three.js is fetched only once the section is close to the viewport, so a visitor
  who never scrolls that far never pays for it. If WebGL is missing or the library
  fails to load, the still image already in the markup stays put.
*/
(function () {
  'use strict';

  var MOUNT = document.getElementById('cut3d');
  if (!MOUNT) return;

  var THREE_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js';

  /* Camera framing and what is emphasised, one entry per step. */
  /* The model stands about 9 units tall once the valve and base are counted, so
     the camera has to sit well back of it at this field of view. */
  var STEPS = {
    outside: { pos: [0, 1.4, 18.5], look: [0, 0.5, 0], cut: 0, focus: null },
    inside:  { pos: [6.2, 1.8, 16.5], look: [0, 0.5, 0], cut: 1, focus: null },
    carbon:  { pos: [5.4, 2.6, 15.5], look: [0, 1.0, 0], cut: 1, focus: 'carbon' },
    gravel:  { pos: [5.4, -1.2, 15.5], look: [0, -1.2, 0], cut: 1, focus: 'gravel' },
    riser:   { pos: [6.4, 0.9, 16.0], look: [0, 0.3, 0], cut: 1, focus: 'riser' },
    valve:   { pos: [3.6, 5.4, 13.5], look: [0, 3.2, 0], cut: 0, focus: 'valve' }
  };

  var state = {
    step: 'outside', t: 0, spin: 0, dragging: false, lastX: 0, userSpin: 0, ready: false
  };
  var cam = { pos: STEPS.outside.pos.slice(), look: STEPS.outside.look.slice(), cut: 0 };

  function lerp(a, b, k) { return a + (b - a) * k; }

  function visible() {
    var r = MOUNT.getBoundingClientRect();
    return r.top < window.innerHeight * 1.6 && r.bottom > -window.innerHeight * 0.6;
  }

  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  function start(THREE) {
    var still = MOUNT.querySelector('.cut-still');
    var scene = new THREE.Scene();
    scene.background = null;

    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.localClippingEnabled = true;
    MOUNT.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');

    /* ---- lighting ---- */
    scene.add(new THREE.HemisphereLight(0xdce9fa, 0x2a3340, 1.5));
    var key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(5, 8, 7); scene.add(key);
    var rim = new THREE.DirectionalLight(0x9fc4ee, 1.3); rim.position.set(-6, 3, -4); scene.add(rim);
    var fill = new THREE.DirectionalLight(0xffffff, 0.7); fill.position.set(-2, -4, 6); scene.add(fill);

    /* ---- materials ---- */
    var clip = new THREE.Plane(new THREE.Vector3(-1, 0, -0.55).normalize(), 2.6);
    function jacketMat() {
      return new THREE.MeshStandardMaterial({
        color: 0x272f3a, metalness: 0.42, roughness: 0.46,
        clippingPlanes: [clip], clipShadows: true, side: THREE.DoubleSide
      });
    }
    function mat(color, rough, metal) {
      return new THREE.MeshStandardMaterial({
        color: color, roughness: rough === undefined ? 0.7 : rough,
        metalness: metal === undefined ? 0.1 : metal, transparent: true, opacity: 1
      });
    }

    var parts = {};
    var root = new THREE.Group();
    scene.add(root);

    /* ---- the tank ---- */
    /* A real tank is a straight cylinder with a shallow crown, not a capsule, so
       the domes are squashed rather than full hemispheres. */
    var R = 1.5, TANK_H = 5.2, CROWN = 0.42;
    var jacket = new THREE.Group();
    var jm = jacketMat();
    var body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, TANK_H, 64, 1, true), jm);
    jacket.add(body);
    var domeTop = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), jm);
    domeTop.scale.y = CROWN; domeTop.position.y = TANK_H / 2; jacket.add(domeTop);
    var domeBot = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), jm);
    domeBot.scale.y = 0.3; domeBot.position.y = -TANK_H / 2; jacket.add(domeBot);
    root.add(jacket);
    parts.tank = { meshes: [body, domeTop, domeBot], mats: [jm] };  /* base and brine join this below */

    var TOP = TANK_H / 2 + R * CROWN;          // outside of the crown
    var FLOOR = -TANK_H / 2 - R * 0.3 - 0.34;  // where the whole thing stands

    /* base skirt the tank stands in */
    var baseM = mat(0x141a22, 0.8, 0.2);
    var base = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.96, R * 1.0, 0.7, 48), baseM);
    base.position.y = -TANK_H / 2 - 0.26; root.add(base);

    /* ---- inside ---- */
    var inner = new THREE.Group(); root.add(inner);
    var IR = R * 0.93;

    var carbonM = mat(0x39434f, 0.95, 0.05);
    var carbon = new THREE.Mesh(new THREE.CylinderGeometry(IR, IR, 2.9, 48), carbonM);
    carbon.position.y = 0.75; inner.add(carbon);
    parts.carbon = { meshes: [carbon], mats: [carbonM] };

    var gravelM = mat(0xaab7c6, 0.95, 0.0);
    var gravel = new THREE.Mesh(new THREE.CylinderGeometry(IR, IR, 1.05, 48), gravelM);
    gravel.position.y = -1.22; inner.add(gravel);
    parts.gravel = { meshes: [gravel], mats: [gravelM] };

    var riserM = mat(0xe7eef6, 0.35, 0.1);
    var riser = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 4.9, 24), riserM);
    riser.position.y = 0.1; inner.add(riser);
    var basket = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.6, 24), riserM);
    basket.position.y = -2.1; inner.add(basket);
    parts.riser = { meshes: [riser, basket], mats: [riserM] };

    /* ---- control valve ---- */
    var valve = new THREE.Group();
    var vm = mat(0x1e262f, 0.5, 0.35);
    var vbody = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.0, 1.25), vm);
    vbody.position.y = TOP + 0.74; valve.add(vbody);
    var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, 0.5, 32), vm);
    neck.position.y = TOP + 0.12; valve.add(neck);
    var screenM = new THREE.MeshStandardMaterial({
      color: 0x8fd2ea, emissive: 0x2d7fa8, emissiveIntensity: 0.65, roughness: 0.3, transparent: true
    });
    var screen = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.42, 0.06), screenM);
    screen.position.set(0, TOP + 0.8, 0.64); valve.add(screen);
    var pipeM = mat(0x46536270, 0.5, 0.4);
    [-1, 1].forEach(function (s) {
      var p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.5, 24), pipeM);
      p.rotation.z = Math.PI / 2; p.position.set(s * 1.5, TOP + 0.74, 0); valve.add(p);
    });
    root.add(valve);
    parts.valve = { meshes: [vbody, neck, screen], mats: [vm, screenM] };

    /* ---- brine tank alongside ---- */
    var brineM = jacketMat(); brineM.clippingPlanes = [];
    var BRINE_H = 3.6;
    var brine = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, BRINE_H, 48), brineM);
    brine.position.set(3.3, FLOOR + BRINE_H / 2, 0); root.add(brine);
    var lid = new THREE.Mesh(new THREE.CylinderGeometry(0.99, 0.99, 0.22, 48), mat(0x12181f, 0.7, 0.3));
    lid.position.set(3.3, FLOOR + BRINE_H + 0.06, 0); root.add(lid);

    /* the shell parts dim together, so focusing a layer does not leave the
       brine tank and base sitting there at full strength */
    parts.tank.mats.push(baseM, brineM, lid.material);

    /* ---- resize ---- */
    function resize() {
      var w = MOUNT.clientWidth, h = MOUNT.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    /* ---- drag to turn it ---- */
    function down(x) { state.dragging = true; state.lastX = x; MOUNT.classList.add('is-grabbing'); }
    function move(x) {
      if (!state.dragging) return;
      state.userSpin += (x - state.lastX) * 0.0075;
      state.lastX = x;
    }
    function up() { state.dragging = false; MOUNT.classList.remove('is-grabbing'); }
    MOUNT.addEventListener('mousedown', function (e) { down(e.clientX); });
    window.addEventListener('mousemove', function (e) { move(e.clientX); });
    window.addEventListener('mouseup', up);
    MOUNT.addEventListener('touchstart', function (e) { down(e.touches[0].clientX); }, { passive: true });
    MOUNT.addEventListener('touchmove', function (e) {
      if (state.dragging) { move(e.touches[0].clientX); e.preventDefault(); }
    }, { passive: false });
    MOUNT.addEventListener('touchend', up);

    /* ---- emphasis ---- */
    function applyFocus(focus) {
      Object.keys(parts).forEach(function (name) {
        var p = parts[name];
        var dim = focus && name !== focus;
        p.mats.forEach(function (m) {
          m.transparent = true;
          m.opacity = dim ? 0.16 : 1;
        });
      });
    }

    /* ---- loop ---- */
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var tmpLook = new THREE.Vector3();
    function frame() {
      requestAnimationFrame(frame);
      if (!visible()) return;

      var target = STEPS[state.step] || STEPS.outside;
      var k = 0.075;
      for (var i = 0; i < 3; i++) {
        cam.pos[i] = lerp(cam.pos[i], target.pos[i], k);
        cam.look[i] = lerp(cam.look[i], target.look[i], k);
      }
      cam.cut = lerp(cam.cut, target.cut, k);
      clip.constant = lerp(2.6, -0.02, cam.cut);   // slides the cut open

      if (!state.dragging && !reduced) state.spin += 0.0016;
      root.rotation.y = state.spin + state.userSpin;

      camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
      tmpLook.set(cam.look[0], cam.look[1], cam.look[2]);
      camera.lookAt(tmpLook);
      renderer.render(scene, camera);
    }

    applyFocus(null);
    resize();
    frame();
    state.ready = true;
    MOUNT.classList.add('is-live');
    if (still) still.setAttribute('hidden', '');

    /* tabs drive the model */
    document.querySelectorAll('.cut-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var step = tab.getAttribute('data-step');
        state.step = step;
        applyFocus(STEPS[step] ? STEPS[step].focus : null);
      });
    });
  }

  /* ---- tab switching works with or without the 3D ---- */
  document.querySelectorAll('.cut-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var step = tab.getAttribute('data-step');
      document.querySelectorAll('.cut-tab').forEach(function (t) { t.classList.toggle('is-on', t === tab); });
      document.querySelectorAll('.cut-panel').forEach(function (p) {
        p.classList.toggle('is-on', p.getAttribute('data-step') === step);
      });
    });
  });

  /* ---- load three.js only when the section is near ---- */
  var loading = false;
  function maybeLoad() {
    if (loading || !visible() || !hasWebGL()) return;
    loading = true;
    window.removeEventListener('scroll', maybeLoad);
    import(/* webpackIgnore: true */ THREE_SRC)
      .then(function (THREE) { start(THREE); })
      .catch(function () { /* still image stays */ });
  }
  window.addEventListener('scroll', maybeLoad, { passive: true });
  window.addEventListener('resize', maybeLoad, { passive: true });
  maybeLoad();
})();
