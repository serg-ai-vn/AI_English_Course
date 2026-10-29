/* ============================================================
   Avatar flight
   The avatar travels between the hero dock and the About dock,
   driven purely by scroll position (works both directions).
   On each docking the Particle Assemble replays.

   Debug: add ?flight=0.5 to the URL to freeze mid-flight.
   ============================================================ */
window.AvatarFlight = (function () {
  'use strict';

  var slot, dockHero, dockAbout;
  var state = null;              /* 'hero' | 'about' | null (flying) */
  var REPLAY = true;             /* replay Particle Assemble on docking */
  var forced = null;             /* debug override from ?flight= */

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function progress() {
    if (forced !== null) return forced;
    var vh = window.innerHeight;
    var r = dockAbout.getBoundingClientRect();
    /* t=0: About dock top at viewport bottom edge
       t=1: About dock top at 45% viewport height */
    return clamp01((vh - r.top) / (vh * 0.55));
  }

  function layout() {
    var p = progress();
    var t = easeInOut(p);
    var a = dockHero.getBoundingClientRect();
    var b = dockAbout.getBoundingClientRect();

    slot.style.top = lerp(a.top, b.top, t) + 'px';
    slot.style.left = lerp(a.left, b.left, t) + 'px';
    slot.style.width = lerp(a.width, b.width, t) + 'px';
    slot.style.height = lerp(a.height, b.height, t) + 'px';

    if (forced !== null) return; /* debug mode: no docking logic */

    if (p >= 1 && state !== 'about') {
      state = 'about';
      replay();
    } else if (p <= 0 && state !== 'hero') {
      state = 'hero';
      replay();
    } else if (p > 0 && p < 1) {
      state = null;
    }
  }

  function replay() {
    if (!REPLAY) return;
    if (window.ParticleAssemble) ParticleAssemble.run(slot);
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      layout();
      ticking = false;
    });
  }

  function init() {
    slot = document.getElementById('slot-avatar');
    dockHero = document.getElementById('avatar-dock-hero');
    dockAbout = document.getElementById('avatar-dock-about');
    if (!slot || !dockHero || !dockAbout) return;

    var q = parseFloat(new URLSearchParams(location.search).get('flight'));
    if (!isNaN(q)) forced = clamp01(q);

    slot.classList.add('is-armed');
    layout();
    /* First assemble is handled by ParticleAssemble's own observer;
       here we only record where we are, without replaying */
    if (forced === null) {
      state = progress() >= 1 ? 'about' : 'hero';
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('load', onScroll);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init: init };
})();
