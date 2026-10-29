/* ============================================================
   Particle Assemble (week 2/3 core effect)
   The avatar dissolves into particles and reassembles when the
   visitor scrolls to it. One-way, runs once, then the real image
   fades in and the animation loop stops completely.

   - Canvas 2D, no WebGL, no libraries
   - Particle data is PRECOMPUTED server-side (tools/site-builder.js#sampleParticles)
     and arrives as window.PARTICLE_DATA[slotName]. The device never
     samples pixels: no CORS issues, no CPU cost.
   - Particle color comes from the active preset (--particle-color),
     luminance of the source image gives each particle size/alpha.
   - Weak devices get a smaller particle budget automatically.
   - prefers-reduced-motion or missing data = plain image, no effect.
   ============================================================ */
window.ParticleAssemble = (function () {
  'use strict';

  var DURATION = 1900;        /* ms, full assemble time */
  var DELAY_SPREAD = 0.35;    /* per-particle stagger, fraction of DURATION */
  var SCATTER = 0.55;         /* scatter distance, fraction of box size */
  var PAD = 0.35;             /* canvas overflow around the slot, fraction */
  var DONE_EVENT = 'particle-assemble:done';

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* Particle budget by device capability. Cheap tablets get less. */
  function deviceBudget() {
    var mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    var mem = navigator.deviceMemory || 4;
    var cores = navigator.hardwareConcurrency || 4;
    if (mem <= 2 || cores <= 2) return 700;
    if (mobile || mem <= 4 || cores <= 4) return 1400;
    return 3000;
  }

  function accentColor() {
    var v = getComputedStyle(document.documentElement)
      .getPropertyValue('--particle-color');
    return (v && v.trim()) || '#8052FF';
  }

  /* Particle shape follows the active preset (Preset v3):
     circle | square | triangle | diamond */
  function particleShape() {
    var v = getComputedStyle(document.documentElement)
      .getPropertyValue('--particle-shape');
    v = (v && v.trim()) || 'square';
    return ['circle', 'square', 'triangle', 'diamond'].indexOf(v) !== -1
      ? v : 'square';
  }

  function drawParticle(ctx, shape, x, y, s) {
    var h;
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(x, y, s / 2, 0, 6.2832);
      ctx.fill();
    } else if (shape === 'triangle') {
      h = s * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x + h, y + h * 0.75);
      ctx.lineTo(x - h, y + h * 0.75);
      ctx.closePath();
      ctx.fill();
    } else if (shape === 'diamond') {
      h = s * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x + h, y);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x - h, y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
  }

  function canvasSupported() {
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext && c.getContext('2d'));
    } catch (e) {
      return false;
    }
  }

  /* CSS fallback: no particles, the image settles with blur+scale */
  function cssFallback(slot) {
    var img = slot.querySelector('img');
    if (img) img.classList.add('pa-fallback-img');
  }

  function subsample(points, budget) {
    if (points.length <= budget) return points;
    var out = [];
    var step = points.length / budget;
    for (var i = 0; i < points.length; i += step) {
      out.push(points[Math.floor(i)]);
    }
    return out;
  }

  function buildParticles(data, cw, ch, budget) {
    var pts = subsample(data.points, budget);
    var cols = Math.max(1, Math.round(data.w / data.step));
    var cell = cw / cols;
    var base = Math.max(1.6, cell * 0.8);
    var R = Math.max(cw, ch) * SCATTER;
    var list = new Array(pts.length);
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var l = p[2] / 100;                       /* luminance 0..1 */
      var tx = (p[0] / data.w) * cw;
      var ty = (p[1] / data.h) * ch;
      var ang = Math.random() * Math.PI * 2;
      var dist = R * (0.35 + Math.random() * 0.65);
      list[i] = {
        sx: tx + Math.cos(ang) * dist,
        sy: ty + Math.sin(ang) * dist,
        tx: tx,
        ty: ty,
        size: base * (0.6 + 0.75 * l),
        alpha: 0.3 + 0.7 * l,
        delay: Math.random() * DELAY_SPREAD
      };
    }
    return list;
  }

  function drawFrame(ctx, particles, t, color, shape, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var lt = easeOutCubic(clamp01(t * (1 + DELAY_SPREAD) - p.delay));
      var x = p.sx + (p.tx - p.sx) * lt;
      var y = p.sy + (p.ty - p.sy) * lt;
      ctx.globalAlpha = p.alpha;
      drawParticle(ctx, shape, x, y, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function finish(canvas, img, slot, frames, elapsed, count) {
    var fps = Math.round(frames / (elapsed / 1000));
    if (img) {
      img.classList.add('pt-show');
      canvas.style.opacity = '0';
      window.setTimeout(function () {
        canvas.remove();
        slot.classList.remove('particle-running');
        img.classList.remove('particle-target', 'pt-show');
      }, 520);
    } else {
      /* No image to reveal: keep the assembled frame on screen */
      slot.classList.remove('particle-running');
    }
    slot.dispatchEvent(new CustomEvent(DONE_EVENT, {
      detail: { fps: fps, particles: count }
    }));
  }

  /* Run the effect on one slot. opts.seek renders a frozen frame. */
  function run(slot, opts) {
    opts = opts || {};
    var store = window.PARTICLE_DATA || {};
    var data = store[slot.getAttribute('data-slot')];
    if (!data) return false;

    var old = slot.querySelector('.particle-canvas');
    if (old) old.remove();

    var rect = slot.getBoundingClientRect();
    if (rect.width < 10) return false;

    var img = slot.querySelector('img');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var span = 1 + 2 * PAD;

    var canvas = document.createElement('canvas');
    canvas.className = 'particle-canvas';
    canvas.style.cssText =
      'position:absolute;pointer-events:none;z-index:2;' +
      'left:' + (-PAD * 100) + '%;top:' + (-PAD * 100) + '%;' +
      'width:' + (span * 100) + '%;height:' + (span * 100) + '%;' +
      'transition:opacity 380ms ease;';
    canvas.width = Math.round(rect.width * span * dpr);
    canvas.height = Math.round(rect.height * span * dpr);
    slot.appendChild(canvas);

    var ctx = null;
    try {
      ctx = canvas.getContext('2d');
    } catch (e) {
      ctx = null;
    }
    if (!ctx) {
      canvas.remove();
      cssFallback(slot);
      return false;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    slot.classList.add('particle-running');
    if (img) img.classList.add('particle-target');

    var budget = opts.budget || deviceBudget();
    var offX = rect.width * PAD;
    var offY = rect.height * PAD;
    var particles = buildParticles(data, rect.width, rect.height, budget);
    for (var i = 0; i < particles.length; i++) {
      particles[i].sx += offX; particles[i].tx += offX;
      particles[i].sy += offY; particles[i].ty += offY;
    }
    var color = accentColor();
    var shape = particleShape();
    var w = rect.width * span;
    var h = rect.height * span;

    if (typeof opts.seek === 'number') {
      drawFrame(ctx, particles, clamp01(opts.seek), color, shape, w, h);
      return true;
    }

    var start = null;
    var frames = 0;
    var finished = false;
    function step(ts) {
      if (finished) return;
      if (start === null) start = ts;
      var elapsed = ts - start;
      frames++;
      var t = clamp01(elapsed / DURATION);
      drawFrame(ctx, particles, t, color, shape, w, h);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        finished = true;
        finish(canvas, img, slot, frames, elapsed, particles.length);
      }
    }
    requestAnimationFrame(step);
    /* Safety net: if rAF is throttled (background tab, weak device),
       force the final state so the image is never stuck hidden */
    window.setTimeout(function () {
      if (!finished) {
        finished = true;
        finish(canvas, img, slot, frames, DURATION, particles.length);
      }
    }, DURATION + 1500);
    return true;
  }

  /* Arm every [data-particle-src] slot that has precomputed data */
  function init(root) {
    root = root || document;
    if (reducedMotion()) return;
    if (!('IntersectionObserver' in window)) return;
    var store = window.PARTICLE_DATA || {};
    var slots = root.querySelectorAll('[data-particle-src]');
    Array.prototype.forEach.call(slots, function (slot) {
      if (slot.__paArmed) return;
      /* No data yet: leave for a later init() call (e.g. demo loader) */
      if (!store[slot.getAttribute('data-slot')]) return;
      slot.__paArmed = true;
      /* No usable canvas anywhere on this device: CSS fallback once */
      if (!canvasSupported()) {
        cssFallback(slot);
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            io.disconnect();
            run(slot);
          }
        });
      }, { threshold: 0.35 });
      io.observe(slot);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }

  return {
    init: init,
    run: run,
    budget: deviceBudget,
    DONE_EVENT: DONE_EVENT
  };
})();
