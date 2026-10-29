/* ============================================================
   Uniform motion (week 2)
   Three effects, same for every site (spec 16_source_theme_presets):
   - fade-up     : Fade & Rise
   - slide-left  : Side Slide (alternating)
   - slide-right : Side Slide (alternating)
   - letters     : Letter Reveal (hero name/tagline)

   IntersectionObserver + CSS transitions. No libraries.
   Elements are visible by default; JS arms the hidden state.
   ============================================================ */
(function () {
  'use strict';

  /* Respect user/OS preference: skip all animation */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  /* --- Letter Reveal: split target text into animated chars.
         Words are wrapped in nowrap spans so lines never break
         in the middle of a word. --- */
  var letterTargets = document.querySelectorAll('[data-reveal="letters"]');
  Array.prototype.forEach.call(letterTargets, function (el) {
    var text = el.textContent;
    el.setAttribute('aria-label', text);
    el.textContent = '';
    var frag = document.createDocumentFragment();
    var words = text.split(' ');
    var index = 0;
    words.forEach(function (word, wi) {
      var w = document.createElement('span');
      w.setAttribute('aria-hidden', 'true');
      w.style.display = 'inline-block';
      w.style.whiteSpace = 'nowrap';
      Array.prototype.forEach.call(word, function (ch) {
        var s = document.createElement('span');
        s.className = 'rv-ch';
        s.textContent = ch;
        s.style.transitionDelay = (index * 30) + 'ms';
        index++;
        w.appendChild(s);
      });
      frag.appendChild(w);
      if (wi < words.length - 1) {
        frag.appendChild(document.createTextNode(' '));
      }
    });
    el.appendChild(frag);
  });
    el.appendChild(frag);
  });

  /* --- Arm + observe everything marked data-reveal --- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('rv-in');
        io.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.18,
    rootMargin: '0px 0px -6% 0px'
  });

  var targets = document.querySelectorAll('[data-reveal]');
  Array.prototype.forEach.call(targets, function (el) {
    el.classList.add('rv');
    io.observe(el);
  });
})();
