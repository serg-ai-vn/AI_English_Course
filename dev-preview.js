/* ============================================================
   DEV PREVIEW ONLY - remove before production.
   1. Theme switcher for local review of the 6 presets
      (click dots, or open index.html?theme=deep-focus)
   2. Demo content fill: index.html?demo=1 injects demo images
      from demo-assets/ and loads the precomputed particle data,
      so the full effect can be reviewed locally.
   ============================================================ */
(function () {
  var THEMES = [
    'sunny-day',
    'ocean-calm',
    'forest-explorer',
    'comic-pop',
    'comet-trail',
    'deep-focus'
  ];

  var root = document.documentElement;

  function setTheme(name) {
    if (THEMES.indexOf(name) === -1) return;
    root.setAttribute('data-theme', name);
    try { localStorage.setItem('preview-theme', name); } catch (e) {}
    markActive(name);
  }

  function markActive(name) {
    var buttons = document.querySelectorAll('.dev-theme-dot');
    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i].getAttribute('data-set-theme') === name;
      buttons[i].setAttribute('aria-pressed', active ? 'true' : 'false');
      buttons[i].style.borderColor = active ? '#fff' : 'transparent';
    }
  }

  var params = new URLSearchParams(location.search);

  /* Priority: URL param > localStorage > attribute in HTML */
  var stored = null;
  try { stored = localStorage.getItem('preview-theme'); } catch (e) {}
  if (params.get('theme')) {
    setTheme(params.get('theme'));
  } else if (stored) {
    setTheme(stored);
  }

  /* --- Demo content fill (?demo=1) --- */
  if (params.get('demo') === '1') {
    var IMAGES = {
      'background': 'demo-assets/background.jpg',
      'avatar': 'demo-assets/avatar.jpg',
      'hobby-image-1': 'demo-assets/hobby-1.jpg',
      'hobby-image-2': 'demo-assets/hobby-2.jpg',
      'hobby-image-3': 'demo-assets/hobby-3.jpg'
    };
    Object.keys(IMAGES).forEach(function (slotName) {
      var slot = document.querySelector('[data-slot="' + slotName + '"]');
      if (slot) {
        slot.innerHTML = '<img src="' + IMAGES[slotName] + '" alt="">';
      }
    });
    /* Particle data arrives asynchronously; re-init after load */
    var s = document.createElement('script');
    s.src = 'demo-assets/avatar-particles.js';
    s.onload = function () {
      if (window.ParticleAssemble) window.ParticleAssemble.init();
    };
    document.body.appendChild(s);
  }

  /* --- Floating dot switcher --- */
  var COLORS = {
    'sunny-day': '#FF9F1C',
    'ocean-calm': '#3A86FF',
    'forest-explorer': '#4C7A5D',
    'comic-pop': '#E63946',
    'comet-trail': '#6C5CE7',
    'deep-focus': '#8052FF'
  };

  var bar = document.createElement('div');
  bar.style.cssText =
    'position:fixed;right:14px;bottom:14px;z-index:9999;' +
    'display:flex;gap:8px;padding:8px 10px;border-radius:9999px;' +
    'background:rgba(20,20,20,0.75);backdrop-filter:blur(6px);';

  THEMES.forEach(function (name) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'dev-theme-dot';
    b.title = name;
    b.setAttribute('data-set-theme', name);
    b.setAttribute('aria-label', 'Preview theme: ' + name);
    b.setAttribute('aria-pressed', 'false');
    b.style.cssText =
      'width:16px;height:16px;border-radius:50%;border:2px solid transparent;' +
      'cursor:pointer;padding:0;background:' + COLORS[name] + ';';
    b.addEventListener('click', function () { setTheme(name); });
    bar.appendChild(b);
  });

  document.body.appendChild(bar);
  markActive(root.getAttribute('data-theme'));
})();
