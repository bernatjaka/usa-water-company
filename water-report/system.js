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
  var topLimit = 0;      // on phones, where the copy above ends
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
    var wide = W > 900;

    if (wide) {
      /* Desktop: system on the right, copy on the left. */
      var cx = W * 0.70;
      var pipeW = Math.max(30, Math.min(58, W * 0.042));
      var mainY = Math.max(H * 0.19, 150);
      var tankY = H * 0.31, tankH = H * 0.22;
      var tankW = Math.min(pipeW * 3.0, W * 0.24);
      var manY = H * 0.635;
      var drop = pipeW * 1.35;
      var glassH = H * 0.095, appH = H * 0.125;
      var spread = pipeW * 2.9;
      setGeom(cx, pipeW, mainY, tankY, tankH, tankW, manY, drop, spread, glassH, appH);
      return;
    }

    /* Phone. Sized from the screen it is on, not shrunk down from the
       desktop numbers, which is what made it look pinched. The run uses
       about two thirds of the width and the lower half of the height. */
    var cxm = W * 0.5;
    var pw  = Math.max(22, Math.min(34, W * 0.072));
    /* ~67% of the screen, but never so wide that the end fitting
       could run off the edge on a narrow phone. */
    var spreadm = Math.min(W * 0.335, W * 0.5 - pw * 1.15 - 10);
    var tankWm  = Math.min(W * 0.40, pw * 5.2);

    /* Start below whatever copy is actually on screen, measured, rather
       than a guessed fraction that breaks whenever the text changes. */
    var mainYm = Math.max(H * 0.38, Math.min(H * 0.60, topLimit));
    var room   = H - mainYm;                 /* the whole run has to fit in here */
    var tankYm = mainYm + room * 0.10;
    var tankHm = room * 0.26;
    var manYm  = mainYm + room * 0.60;
    var dropm  = pw * 1.0;

    setGeom(cxm, pw, mainYm, tankYm, tankHm, tankWm, manYm, dropm,
            spreadm, room * 0.12, room * 0.15);
  }

  function setGeom(cx, pipeW, mainY, tankY, tankH, tankW, manY, drop, spread, glassH, appH) {
    var showerX = cx - spread, tapX = cx, appX = cx + spread;
    S = {
      cx: cx, pipeW: pipeW,
      mainY: mainY, mainX0: -20, meterX: Math.max(pipeW * 1.4, cx - pipeW * 4.2),
      inletTop: mainY, inletBot: tankY,
      tankX: cx - tankW / 2, tankY: tankY, tankW: tankW, tankH: tankH,
      bedY: tankY + tankH * 0.42,
      outTop: tankY + tankH, outBot: manY, spoutY: manY,
      manY: manY, manX0: showerX, manX1: appX,
      showerX: showerX, showerY: manY + drop,
      tapX: tapX,       tapY: manY + drop,
      appX: appX,       appY: manY + drop,
      glassW: pipeW * 1.7, glassH: glassH,
      appW: pipeW * 2.3,   appH: appH
    };
  }

  /* ---- particles ---- */
  var dirty = [];   // contaminants riding the inlet run
  var caught = [];  // trapped in the media bed
  var bubbles = []; // clean water below the filter

  function spawnDirty() {
    if (!S.pipeW) return;
    dirty.push({
      d: -Math.random() * 60,                          /* distance along the run */
      off: (Math.random() - 0.5) * (S.pipeW * 0.5),    /* sideways drift */
      r: 1.3 + Math.random() * 2.4,
      v: 1.5 + Math.random() * 1.9,
      c: Math.random() < 0.45 ? RUST : DIRT,
      w: Math.random() * 6.28
    });
  }

  function spawnBubble() {
    bubbles.push({
      x: S.cx + (Math.random() - 0.5) * (S.pipeW * 0.5),
      y: S.manY,
      r: 0.8 + Math.random() * 1.6,
      v: 0.4 + Math.random() * 0.8
    });
  }

  /* The inlet is one path: in from the street, round the elbow, down into
     the house. Water is revealed along it with a dash, which is what makes
     the corner read as flow rather than two rectangles meeting. */
  function inletPath() {
    var r = Math.min(S.pipeW * 0.9, (S.cx - S.mainX0) * 0.4, (S.inletBot - S.mainY) * 0.4);
    ctx.beginPath();
    ctx.moveTo(S.mainX0, S.mainY);
    ctx.arcTo(S.cx, S.mainY, S.cx, S.inletBot, r);
    ctx.lineTo(S.cx, S.inletBot);
    return (S.cx - S.mainX0) + (S.inletBot - S.mainY) - r * 0.43;   /* ~arc shortening */
  }

  /* One continuous run from the tank out to a fixture, with rounded
     elbows at the tee and at the drop, so the clean side reads the same
     as the inlet rather than as stacked rectangles. */
  function branchPath(fx, fy) {
    ctx.beginPath();
    ctx.moveTo(S.cx, S.outTop);
    var dx = fx - S.cx;
    if (Math.abs(dx) < 2) { ctx.lineTo(fx, fy); return (fy - S.outTop); }
    var r = Math.min(S.pipeW * 0.75, Math.abs(dx) * 0.45, (fy - S.manY) * 0.45,
                     (S.manY - S.outTop) * 0.45);
    ctx.arcTo(S.cx, S.manY, fx, S.manY, r);
    ctx.arcTo(fx, S.manY, fx, fy, r);
    ctx.lineTo(fx, fy);
    return (S.manY - S.outTop) + Math.abs(dx) + (fy - S.manY) - r * 0.86;
  }

  /* Position along the inlet path, used to carry particles round the bend. */
  function inletAt(d) {
    var horiz = S.cx - S.mainX0;
    var r = Math.min(S.pipeW * 0.9, horiz * 0.4, (S.inletBot - S.mainY) * 0.4);
    var straight = horiz - r;
    if (d <= straight) return { x: S.mainX0 + d, y: S.mainY, turning: 0 };
    var arcLen = r * Math.PI / 2;
    if (d <= straight + arcLen) {
      var a = (d - straight) / arcLen;                  /* 0 to 1 round the bend */
      var ang = -Math.PI / 2 + a * (Math.PI / 2);
      return { x: S.cx - r + Math.cos(ang) * r,
               y: S.mainY + r + Math.sin(ang) * r, turning: 1 };
    }
    return { x: S.cx, y: S.mainY + r + (d - straight - arcLen), turning: 2 };
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
    /* Strictly in order: nothing starts until the stage before it finishes. */
    var tankFill   = Math.max(0, Math.min(1, (p - 0.32) / 0.26));
    var frontOut   = S.outTop + (S.outBot - S.outTop) * Math.max(0, Math.min(1, (p - 0.60) / 0.20));
    var pour       = Math.max(0, Math.min(1, (p - 0.76) / 0.24));

    /* --- one continuous run: street main, elbow, down into the house --- */
    var inletLen = inletPath();
    ctx.lineCap = 'butt'; ctx.lineJoin = 'round';

    /* conduit shell */
    ctx.strokeStyle = 'rgba(13,35,64,.07)';
    ctx.lineWidth = S.pipeW;
    ctx.stroke();

    /* water, revealed along the path so it turns the corner properly */
    var runP = Math.min(1, p / 0.32);
    if (runP > 0) {
      var travelled = inletLen * runP;
      inletPath();
      var wg = ctx.createLinearGradient(S.mainX0, 0, S.cx, S.inletBot);
      wg.addColorStop(0, 'rgba(146,112,64,.80)');
      wg.addColorStop(1, 'rgba(163,138,94,.62)');
      ctx.strokeStyle = wg;
      ctx.lineWidth = S.pipeW * 0.84;
      ctx.setLineDash([travelled, inletLen + 40]);
      ctx.stroke();

      /* moving highlights, this is what sells it as flowing */
      if (!REDUCED) {
        inletPath();
        ctx.strokeStyle = 'rgba(255,255,255,.20)';
        ctx.lineWidth = S.pipeW * 0.28;
        ctx.setLineDash([S.pipeW * 0.55, S.pipeW * 2.3]);
        ctx.lineDashOffset = -(t * 2.2) % (S.pipeW * 2.85);
        ctx.stroke();
        ctx.lineDashOffset = 0;

        /* paint the dry remainder back over, so highlights never appear
           beyond the water front. A rect clip cannot express "first N
           units along a bent path", which is what caused the blocks. */
        if (runP < 0.999) {
        var rest = inletLen - travelled + 40;
        inletPath();
        ctx.strokeStyle = 'rgba(13,35,64,.07)';
        ctx.lineWidth = S.pipeW;
        ctx.setLineDash([rest, inletLen * 2]);
        ctx.lineDashOffset = -travelled;
        ctx.stroke();
        ctx.lineDashOffset = 0;
        }
      }
      ctx.setLineDash([]);
    }

    /* --- contaminants riding the run --- */
    if (!REDUCED && p > 0.02 && t % 4 === 0 && dirty.length < 90) spawnDirty();
    for (var i = dirty.length - 1; i >= 0; i--) {
      var d = dirty[i];
      if (!REDUCED) d.d += d.v;
      d.w += 0.06;
      var pt = inletAt(d.d);
      if (pt.y >= S.bedY - d.r && pt.turning === 2) {
        if (caught.length > 150) caught.shift();
        caught.push({ x: S.tankX + 8 + Math.random() * (S.tankW - 16),
                      y: S.bedY + 3 + Math.random() * (S.tankY + S.tankH - S.bedY - 8),
                      r: d.r, c: d.c });
        dirty.splice(i, 1);
        continue;
      }
      if (d.d > inletLen * runP) continue;     /* not reached by the water yet */
      var wob = Math.sin(d.w) * 1.8;
      var px = pt.x + (pt.turning === 2 ? d.off + wob : 0);
      var py = pt.y + (pt.turning === 2 ? 0 : d.off + wob);
      ctx.fillStyle = d.c; ctx.globalAlpha = .70;
      ctx.beginPath(); ctx.arc(px, py, d.r, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
    }

    /* --- water meter on the main --- */
    var mw = S.pipeW * 1.05, mh = S.pipeW * 0.86;
    ctx.fillStyle = '#fff';
    roundRect(S.meterX - mw / 2, S.mainY - mh / 2, mw, mh, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(13,35,64,.34)'; ctx.lineWidth = 2;
    roundRect(S.meterX - mw / 2, S.mainY - mh / 2, mw, mh, 5); ctx.stroke();
    ctx.strokeStyle = 'rgba(13,35,64,.28)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(S.meterX, S.mainY, mh * 0.26, 0, 6.2832); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(S.meterX, S.mainY);
    var ang2 = -1.2 + Math.sin(t * 0.04) * 0.9;
    ctx.lineTo(S.meterX + Math.cos(ang2) * mh * 0.2, S.mainY + Math.sin(ang2) * mh * 0.2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(13,35,64,.42)';
    ctx.font = '600 ' + Math.max(9, S.pipeW * 0.20) + 'px Archivo, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CITY SUPPLY', S.meterX, S.mainY + mh * 1.05);
    ctx.textAlign = 'left';

    /* --- tank --- */
    ctx.save();
    roundRect(S.tankX, S.tankY, S.tankW, S.tankH, S.pipeW * 0.42);
    ctx.clip();

    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.fillRect(S.tankX, S.tankY, S.tankW, S.tankH);

    /* water inside, murky at the top, clearing toward the bed */
    if (tankFill > 0) {
      var wy = S.tankY + S.tankH * (1 - tankFill);
      var bottom = S.tankY + S.tankH;

      /* below the bed it has been through the media, so it is clean */
      var cleanTop = Math.max(wy, S.bedY);
      if (bottom > cleanTop) {
        ctx.fillStyle = 'rgba(42,94,170,.48)';
        ctx.fillRect(S.tankX, cleanTop, S.tankW, bottom - cleanTop);
      }
      /* above the bed it is still the water that came in */
      if (wy < S.bedY) {
        var dg = ctx.createLinearGradient(0, wy, 0, S.bedY);
        dg.addColorStop(0, 'rgba(146,112,64,.66)');
        dg.addColorStop(1, 'rgba(150,130,100,.42)');
        ctx.fillStyle = dg;
        ctx.fillRect(S.tankX, wy, S.tankW, S.bedY - wy);
      }
      /* the stream still coming in from the drop above */
      if (tankFill < 0.995 && !REDUCED) {
        ctx.fillStyle = 'rgba(146,112,64,.55)';
        var strX = S.cx + Math.sin(t * 0.26) * 1.4;
        ctx.fillRect(strX - S.pipeW * 0.13, S.tankY, S.pipeW * 0.26, wy - S.tankY);
      }
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

    /* --- clean side: three branches, each one continuous run --- */
    var CLEAN = '#7f9fcb';        /* opaque: the three branches share a trunk */
    var SHELL = '#e8e7e2';
    var branches = [
      { x: S.showerX, y: S.showerY },
      { x: S.tapX,    y: S.tapY    },
      { x: S.appX,    y: S.appY    }
    ];

    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    /* shells */
    for (var bx = 0; bx < branches.length; bx++) {
      branchPath(branches[bx].x, branches[bx].y);
      ctx.strokeStyle = SHELL;
      ctx.lineWidth = (bx === 1 ? S.pipeW : S.pipeW * 0.62);
      ctx.stroke();
    }

    /* water, revealed along each branch in turn */
    var outP = Math.max(0, Math.min(1, (p - 0.58) / 0.20));
    if (outP > 0) {
      for (var bw = 0; bw < branches.length; bw++) {
        var bLen = branchPath(branches[bw].x, branches[bw].y);
        ctx.strokeStyle = CLEAN;
        ctx.lineWidth = (bw === 1 ? S.pipeW * 0.84 : S.pipeW * 0.50);
        ctx.setLineDash([bLen * outP, bLen + 60]);
        ctx.stroke();
        ctx.setLineDash([]);

        if (!REDUCED && bw === 1) {
          branchPath(branches[bw].x, branches[bw].y);
          ctx.strokeStyle = 'rgba(255,255,255,.26)';
          ctx.lineWidth = (bw === 1 ? S.pipeW * 0.26 : S.pipeW * 0.16);
          ctx.setLineDash([S.pipeW * 0.4, S.pipeW * 1.9]);
          ctx.lineDashOffset = -(t * 2.4) % (S.pipeW * 2.3);
          ctx.stroke();
          ctx.lineDashOffset = 0;
        }
        if (!REDUCED) {
          if (outP < 0.999) {
            branchPath(branches[bw].x, branches[bw].y);
            ctx.strokeStyle = SHELL;
            ctx.lineWidth = (bw === 1 ? S.pipeW : S.pipeW * 0.62);
            ctx.setLineDash([bLen - bLen * outP + 60, bLen * 2]);
            ctx.lineDashOffset = -(bLen * outP);
            ctx.stroke();
            ctx.lineDashOffset = 0;
          }
          ctx.setLineDash([]);
        }
      }

      /* bubbles in the trunk */
      if (!REDUCED && t % 8 === 0 && bubbles.length < 24) spawnBubble();
      for (var bi = bubbles.length - 1; bi >= 0; bi--) {
        var bu = bubbles[bi];
        if (!REDUCED) bu.y -= bu.v;
        if (bu.y < S.outTop) { bubbles.splice(bi, 1); continue; }
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(bu.x, bu.y, bu.r, 0, 6.2832); ctx.stroke();
      }
    }
    ctx.lineCap = 'butt';

    /* --- the three fixtures --- */
    var NAVY_S = 'rgba(13,35,64,.55)';

    var useP = Math.max(0, Math.min(1, (p - 0.78) / 0.22));
    var jig = REDUCED ? 0 : Math.sin(t * 0.3) * 0.8;

    /* 1, shower */
    var hw = S.pipeW * 1.5, hh = S.pipeW * 0.38;
    ctx.fillStyle = NAVY_S;
    ctx.beginPath();
    ctx.moveTo(S.showerX - hw / 2, S.showerY);
    ctx.lineTo(S.showerX + hw / 2, S.showerY);
    ctx.lineTo(S.showerX + hw * 0.36, S.showerY + hh);
    ctx.lineTo(S.showerX - hw * 0.36, S.showerY + hh);
    ctx.closePath(); ctx.fill();
    if (useP > 0.05) {
      ctx.strokeStyle = 'rgba(42,94,170,.45)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (var sp = 0; sp < 7; sp++) {
        var sx = S.showerX - hw * 0.30 + (hw * 0.60 / 6) * sp;
        var fall = (t * 2.6 + sp * 22) % (S.pipeW * 1.9);
        var len = S.pipeW * 0.42 * Math.min(1, useP * 2);
        ctx.beginPath();
        ctx.moveTo(sx + (sx - S.showerX) * 0.10, S.showerY + hh + fall);
        ctx.lineTo(sx + (sx - S.showerX) * 0.14, S.showerY + hh + fall + len);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }

    /* 2, kitchen tap into a glass */
    var neck = S.pipeW * 0.85;
    ctx.strokeStyle = NAVY_S; ctx.lineWidth = S.pipeW * 0.24; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(S.tapX, S.tapY);
    ctx.quadraticCurveTo(S.tapX, S.tapY - neck * 0.1, S.tapX + neck * 0.55, S.tapY + neck * 0.18);
    ctx.lineTo(S.tapX + neck * 0.55, S.tapY + neck * 0.42);
    ctx.stroke();
    ctx.lineCap = 'butt';

    var gw = S.glassW, gh = S.glassH;
    var gx = S.tapX + neck * 0.55 - gw / 2, gy = S.tapY + neck * 0.95;
    if (useP > 0.12) {
      ctx.fillStyle = 'rgba(42,94,170,.45)';
      ctx.fillRect(S.tapX + neck * 0.55 - 2 + jig, S.tapY + neck * 0.42, 4, gy - S.tapY - neck * 0.42 + 4);
      var lvl = gh * 0.78 * Math.min(1, (useP - 0.12) / 0.6);
      ctx.fillStyle = 'rgba(42,94,170,.40)';
      ctx.fillRect(gx + 2.5, gy + gh - lvl, gw - 5, lvl);
      ctx.fillStyle = 'rgba(210,231,250,.8)';
      ctx.fillRect(gx + 2.5, gy + gh - lvl, gw - 5, 2);
    }
    ctx.strokeStyle = 'rgba(13,35,64,.42)'; ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(gx, gy); ctx.lineTo(gx + 1.5, gy + gh);
    ctx.lineTo(gx + gw - 1.5, gy + gh); ctx.lineTo(gx + gw, gy);
    ctx.stroke();

    /* 3, washing machine */
    var aw = S.appW, ah = S.appH, ax = S.appX - aw / 2, ay = S.appY;
    ctx.fillStyle = '#fff'; roundRect(ax, ay, aw, ah, 5); ctx.fill();
    if (useP > 0.2) {
      ctx.save(); roundRect(ax, ay, aw, ah, 5); ctx.clip();
      var alvl = ah * 0.55 * Math.min(1, (useP - 0.2) / 0.6);
      ctx.fillStyle = 'rgba(42,94,170,.30)';
      ctx.fillRect(ax, ay + ah - alvl, aw, alvl);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(13,35,64,.40)'; ctx.lineWidth = 1.8;
    roundRect(ax, ay, aw, ah, 5); ctx.stroke();
    ctx.beginPath(); ctx.arc(S.appX, ay + ah * 0.55, Math.min(aw, ah) * 0.26, 0, 6.2832); ctx.stroke();
    ctx.strokeStyle = 'rgba(13,35,64,.22)';
    ctx.beginPath(); ctx.moveTo(ax + 5, ay + ah * 0.17); ctx.lineTo(ax + aw - 5, ay + ah * 0.17); ctx.stroke();

    /* labels */
    ctx.fillStyle = 'rgba(13,35,64,.40)';
    ctx.font = '700 ' + Math.max(9, S.pipeW * 0.26) + 'px Archivo, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    var labY = Math.max(S.showerY + hh + S.pipeW * 2.5, gy + gh, ay + ah) + S.pipeW * 0.78;
    ctx.fillText('SHOWER', S.showerX, labY);
    ctx.fillText('DRINKING WATER', S.tapX, labY);
    ctx.fillText('APPLIANCES', S.appX, labY);
    ctx.textAlign = 'left';
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
    /* Phones: tell the scene where the copy above it ends. */
    setTop: function (y) {
      y = Math.round(y || 0);
      if (Math.abs(y - topLimit) < 4) return;
      topLimit = y;
      layout();
    },
    debug: function () {
      return { W:Math.round(W), H:Math.round(H), shown:+shown.toFixed(2), progress:+progress.toFixed(2), mainY:Math.round(S.mainY), rightEdge:Math.round(S.appX + S.appW/2), bottomEdge:Math.round(S.appY + S.appH), leftEdge:Math.round(S.showerX - S.pipeW*0.9),
               inletBot:Math.round(S.inletBot), tankY:Math.round(S.tankY),
               tankH:Math.round(S.tankH), outTop:Math.round(S.outTop),
               outBot:Math.round(S.outBot), pipeW:Math.round(S.pipeW) };
    }
  };
})();
