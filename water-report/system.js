/*
  Scroll-driven filtration animation.

  A canvas scene: dirty water enters at the top, runs down into the
  filter tank where the contaminants are trapped in the media bed, and
  clean water leaves through the faucet into a glass. Scroll position
  drives how far the water front has travelled; everything else runs
  continuously so the scene is alive even when still.
*/
(function () {
  var cv = document.getElementById('sys');
  var block = document.getElementById('wr-block');   // when embedded in a page
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');

  var REDUCED = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var NAVY='#0d2340', BLUE='#2a5eaa', PALE='#bcd8f4', DIRT='#9a7b4f', RUST='#b5651d';

  var W=0, H=0, DPR=1;
  var progress = 0;      // 0 to 1, from scroll
  var locked = false;    // test hook, see WaterSystem.lock
  var shown = 0;         // eased follower so motion stays smooth

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    layout();
  }

  /* Scene geometry, recomputed on resize so it stays responsive. */
  var S = {};
  function layout() {
    /* Sits in the right third on wide screens so the copy has the left. */
    var wide = W > 900;
    var cx = wide ? W * 0.72 : W * 0.5;
    var pipeW = wide ? Math.max(40, Math.min(78, W * 0.055))
                     : Math.max(34, Math.min(62, W * 0.13));
    var tankW = pipeW * 2.9;
    var tankH = Math.min(H * 0.34, tankW * 1.5);
    var mainY = Math.max(H * 0.23, 170);   /* clears the promo bar, top bar and sticky header */
    var tankY = Math.max(H * 0.40, mainY + pipeW * 2.4);
    S = {
      cx: cx, pipeW: pipeW,
      mainY: mainY, mainX0: -20, meterX: cx - pipeW * 3.4,
      inletTop: mainY, inletBot: tankY,
      tankX: cx - tankW / 2, tankY: tankY, tankW: tankW, tankH: tankH,
      bedY: tankY + tankH * 0.52,                 // top of the media bed
      outTop: tankY + tankH, outBot: H * 0.755,
      spoutY: H * 0.755, spoutX: cx + pipeW * 1.7,
      glassX: cx + pipeW * 1.7 - pipeW * 0.95, glassY: H * 0.80,
      glassW: pipeW * 1.9, glassH: H * 0.135
    };
  }

  /* ---- particles ---- */
  var dirty = [];   // contaminants coming down the inlet
  var caught = [];  // trapped in the media bed
  var bubbles = []; // clean water below the filter

  function spawnDirty() {
    if (!S.pipeW) return;
    dirty.push({
      x: S.mainX0 - Math.random() * 60,
      y: S.mainY + (Math.random() - 0.5) * (S.pipeW * 0.55),
      r: 1.3 + Math.random() * 2.4,
      v: 1.4 + Math.random() * 1.8,
      c: Math.random() < 0.45 ? RUST : DIRT,
      w: Math.random() * 6.28,
      turned: false
    });
  }
  function spawnBubble() {
    bubbles.push({
      x: S.cx + (Math.random() - 0.5) * (S.pipeW * 0.5),
      y: S.outBot,
      r: 0.8 + Math.random() * 1.6,
      v: 0.4 + Math.random() * 0.8
    });
  }

  /* ---- drawing helpers ---- */
  function pipe(x, y1, y2, w, fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x - w / 2, y1, w, y2 - y1);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  var t = 0;
  function frame() {
    /* The pinned layer is display:none until its section is on screen,
       which makes the canvas 0x0. Re-measure whenever that changes,
       otherwise we would draw into nothing forever. */
    if (cv.clientWidth !== W || cv.clientHeight !== H) resize();
    if (!W || !H) { requestAnimationFrame(frame); return; }

    t += 1;
    shown += (progress - shown) * 0.08;
    draw();
    requestAnimationFrame(frame);
  }

  function draw() {
    var p = shown;

    ctx.clearRect(0, 0, W, H);

    /* How far the water has descended through the whole run. */
    var frontMain  = S.mainX0 + (S.cx - S.mainX0) * Math.min(1, p / 0.14);
    var frontInlet = S.inletTop + (S.inletBot - S.inletTop) *
                     Math.max(0, Math.min(1, (p - 0.12) / 0.26));
    var tankFill   = Math.max(0, Math.min(1, (p - 0.34) / 0.28));
    var frontOut   = S.outTop + (S.outBot - S.outTop) * Math.max(0, Math.min(1, (p - 0.60) / 0.20));
    var pour       = Math.max(0, Math.min(1, (p - 0.76) / 0.24));

    /* --- street main coming in from the utility --- */
    ctx.fillStyle = 'rgba(13,35,64,.06)';
    ctx.fillRect(S.mainX0, S.mainY - S.pipeW / 2, S.cx - S.mainX0 + S.pipeW / 2, S.pipeW);
    if (frontMain > S.mainX0) {
      var mg = ctx.createLinearGradient(S.mainX0, 0, frontMain, 0);
      mg.addColorStop(0, 'rgba(146,112,64,.78)');
      mg.addColorStop(1, 'rgba(160,134,88,.58)');
      ctx.fillStyle = mg;
      ctx.fillRect(S.mainX0, S.mainY - S.pipeW * 0.41, frontMain - S.mainX0, S.pipeW * 0.82);
    }

    /* water meter on the main */
    var mw = S.pipeW * 1.05, mh = S.pipeW * 0.86;
    ctx.fillStyle = '#fff';
    roundRect(S.meterX - mw / 2, S.mainY - mh / 2, mw, mh, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(13,35,64,.38)'; ctx.lineWidth = 2;
    roundRect(S.meterX - mw / 2, S.mainY - mh / 2, mw, mh, 5); ctx.stroke();
    ctx.strokeStyle = 'rgba(13,35,64,.30)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(S.meterX, S.mainY, mh * 0.26, 0, 6.2832); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(S.meterX, S.mainY);
    var ang = -1.2 + Math.sin(t * 0.04) * 0.9;
    ctx.lineTo(S.meterX + Math.cos(ang) * mh * 0.2, S.mainY + Math.sin(ang) * mh * 0.2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(13,35,64,.45)';
    ctx.font = '600 ' + Math.max(9, S.pipeW * 0.20) + 'px Archivo, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CITY SUPPLY', S.meterX, S.mainY + mh * 1.05);
    ctx.textAlign = 'left';

    /* --- inlet pipe down into the house --- */
    pipe(S.cx, S.mainY, S.inletBot, S.pipeW, 'rgba(13,35,64,.06)');
    if (frontInlet > S.mainY) {
      var g = ctx.createLinearGradient(0, S.mainY, 0, frontInlet);
      g.addColorStop(0, 'rgba(146,112,64,.78)');
      g.addColorStop(1, 'rgba(160,134,88,.58)');
      pipe(S.cx, S.mainY, frontInlet, S.pipeW * 0.82, g);
    }

    /* --- contaminants falling --- */
    if (!REDUCED && p > 0.02 && t % 4 === 0 && dirty.length < 90) spawnDirty();
    for (var i = dirty.length - 1; i >= 0; i--) {
      var d = dirty[i];
      d.w += 0.06;
      if (!REDUCED) {
        if (!d.turned) {
          d.x += d.v;                      /* along the street main */
          if (d.x >= S.cx) { d.turned = true; d.x = S.cx + (Math.random() - 0.5) * (S.pipeW * 0.5); }
        } else {
          d.y += d.v;                      /* down into the house */
        }
      }
      var dx = d.turned ? d.x + Math.sin(d.w) * 2.2 : d.x;
      var dy = d.turned ? d.y : d.y + Math.sin(d.w) * 1.4;
      if (d.turned && d.y >= S.bedY - d.r) {
        /* trapped in the media, but the bed only shows so much */
        if (caught.length > 150) caught.shift();
        caught.push({ x: S.tankX + 8 + Math.random() * (S.tankW - 16),
                      y: S.bedY + 3 + Math.random() * (S.tankY + S.tankH - S.bedY - 8),
                      r: d.r, c: d.c });
        dirty.splice(i, 1);
        continue;
      }
      /* only visible once the water has actually reached it */
      if (!d.turned && d.x > frontMain) continue;
      if (d.turned && d.y > frontInlet) continue;
      ctx.fillStyle = d.c; ctx.globalAlpha = .72;
      ctx.beginPath(); ctx.arc(dx, dy, d.r, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
    }

    /* --- tank --- */
    ctx.save();
    roundRect(S.tankX, S.tankY, S.tankW, S.tankH, S.pipeW * 0.42);
    ctx.clip();

    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.fillRect(S.tankX, S.tankY, S.tankW, S.tankH);

    /* water inside, murky at the top, clearing toward the bed */
    if (tankFill > 0) {
      var wy = S.tankY + S.tankH * (1 - tankFill);
      var tg = ctx.createLinearGradient(0, S.tankY, 0, S.tankY + S.tankH);
      tg.addColorStop(0, 'rgba(146,112,64,.62)');
      tg.addColorStop(.5, 'rgba(120,150,185,.48)');
      tg.addColorStop(1, 'rgba(42,94,170,.52)');
      ctx.fillStyle = tg;
      ctx.fillRect(S.tankX, wy, S.tankW, S.tankY + S.tankH - wy);
    }

    /* media bed */
    ctx.fillStyle = 'rgba(13,35,64,.14)';
    ctx.fillRect(S.tankX, S.bedY, S.tankW, S.tankY + S.tankH - S.bedY);
    for (var m = 0; m < 70; m++) {
      var mx = S.tankX + ((m * 37) % (S.tankW - 6)) + 3;
      var my = S.bedY + 4 + ((m * 53) % (S.tankY + S.tankH - S.bedY - 8));
      ctx.fillStyle = 'rgba(13,35,64,.22)';
      ctx.beginPath(); ctx.arc(mx, my, 1.6, 0, 6.2832); ctx.fill();
    }
    /* what the bed has captured */
    for (var c2 = 0; c2 < caught.length; c2++) {
      var q = caught[c2];
      ctx.fillStyle = q.c; ctx.globalAlpha = .62;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(13,35,64,.30)'; ctx.lineWidth = 2;
    roundRect(S.tankX, S.tankY, S.tankW, S.tankH, S.pipeW * 0.42); ctx.stroke();

    /* --- outlet, now clean --- */
    pipe(S.cx, S.outTop, S.outBot, S.pipeW, 'rgba(13,35,64,.06)');
    if (frontOut > S.outTop) {
      pipe(S.cx, S.outTop, frontOut, S.pipeW * 0.82, 'rgba(42,94,170,.62)');
    }
    if (!REDUCED && frontOut > S.outTop + 10 && t % 7 === 0 && bubbles.length < 40) spawnBubble();
    for (var b = bubbles.length - 1; b >= 0; b--) {
      var bu = bubbles[b];
      bu.y -= bu.v;
      if (bu.y < S.outTop) { bubbles.splice(b, 1); continue; }
      if (bu.y > frontOut) continue;
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(bu.x, bu.y, bu.r, 0, 6.2832); ctx.stroke();
    }

    /* --- spout and glass --- */
    ctx.strokeStyle = NAVY; ctx.lineWidth = Math.max(4, S.pipeW * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(S.cx, S.spoutY);
    ctx.lineTo(S.spoutX, S.spoutY);
    ctx.lineTo(S.spoutX, S.spoutY + S.glassH * 0.22);
    ctx.stroke();

    var gx = S.glassX, gy = S.glassY, gw = S.glassW, gh = S.glassH;
    if (pour > 0) {
      ctx.fillStyle = 'rgba(42,94,170,.34)';
      var jitter = REDUCED ? 0 : Math.sin(t * 0.3) * 0.8;
      ctx.fillRect(S.spoutX - 2 + jitter, S.spoutY + S.glassH * 0.22, 4, gy - S.spoutY - S.glassH * 0.22 + 4);
      var lvl = gh * 0.80 * pour;
      ctx.fillStyle = 'rgba(42,94,170,.48)';
      ctx.fillRect(gx + 3, gy + gh - lvl, gw - 6, lvl);
      ctx.fillStyle = 'rgba(188,216,244,.55)';
      ctx.fillRect(gx + 3, gy + gh - lvl, gw - 6, 3);
    }
    ctx.strokeStyle = 'rgba(13,35,64,.42)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx, gy); ctx.lineTo(gx + 2, gy + gh); ctx.lineTo(gx + gw - 2, gy + gh); ctx.lineTo(gx + gw, gy);
    ctx.stroke();
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);

  /* Scroll feeds the animation. */
  /* When embedded, drive progress from how far through our own block we are. */
  function selfScroll() {
    if (!block || locked) return;   /* cheap, runs straight off the scroll event */
    var r = block.getBoundingClientRect();
    var span = Math.max(1, r.height - window.innerHeight);
    var p = Math.min(1, Math.max(0, -r.top / span));
    progress = p;
  }
  if (block) {
    window.addEventListener('scroll', selfScroll, { passive: true });
    window.addEventListener('resize', selfScroll);
    selfScroll();
  }

  window.WaterSystem = {
    set: function (p, snap) {
      progress = Math.max(0, Math.min(1, p));
      if (snap) shown = progress;
    },
    reset: function () { dirty.length = 0; caught.length = 0; bubbles.length = 0; },
    /* Hold the scene at a fixed point and redraw once. Used to inspect a
       given stage without scrolling; scroll input is ignored while held. */
    lock: function (p) {
      locked = true;
      progress = shown = Math.max(0, Math.min(1, p));
      if (cv.clientWidth !== W || cv.clientHeight !== H) resize();
      if (W && H) draw();
    },
    unlock: function () { locked = false; },
    debug: function () {
      return { W:Math.round(W), H:Math.round(H), shown:+shown.toFixed(2), progress:+progress.toFixed(2),
               inletBot:Math.round(S.inletBot), tankY:Math.round(S.tankY),
               tankH:Math.round(S.tankH), outTop:Math.round(S.outTop),
               outBot:Math.round(S.outBot), pipeW:Math.round(S.pipeW) };
    }
  };
})();
