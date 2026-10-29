/* ============================================================
   Hobbies carousel
   Three cards on a stage: center large, sides small.
   Text is shown only on the center card (CSS-driven).
   Controls: arrow buttons, swipe, click on a side card.
   No libraries, works offline in exported single files.
   ============================================================ */
(function () {
  'use strict';

  var root = document.getElementById('hobby-carousel');
  if (!root) return;
  var stage = root.querySelector('.carousel-stage');
  var cards = stage.querySelectorAll('.hobby');
  if (cards.length !== 3) return;

  /* Stage positions [left, center, right] hold these card indices.
     Start: hobby 1 in the center. */
  var order = [2, 0, 1];

  function apply() {
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.remove('pos-left', 'pos-center', 'pos-right');
    }
    cards[order[0]].classList.add('pos-left');
    cards[order[1]].classList.add('pos-center');
    cards[order[2]].classList.add('pos-right');
  }

  function next() {
    order.push(order.shift());
    apply();
  }

  function prev() {
    order.unshift(order.pop());
    apply();
  }

  var btnNext = root.querySelector('.carousel-next');
  var btnPrev = root.querySelector('.carousel-prev');
  if (btnNext) btnNext.addEventListener('click', next);
  if (btnPrev) btnPrev.addEventListener('click', prev);

  /* Click a side card to bring it to the center */
  for (var i = 0; i < cards.length; i++) {
    (function (idx) {
      cards[idx].addEventListener('click', function () {
        if (order[0] === idx) prev();
        else if (order[2] === idx) next();
      });
    })(i);
  }

  /* Swipe (passive listeners: no scroll blocking on tablets) */
  var startX = null;
  stage.addEventListener('touchstart', function (e) {
    startX = e.touches[0].clientX;
  }, { passive: true });
  stage.addEventListener('touchend', function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) {
      if (dx < 0) next(); else prev();
    }
    startX = null;
  }, { passive: true });

  apply();
})();
