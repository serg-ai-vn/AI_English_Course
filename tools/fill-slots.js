/* ============================================================
   Slot filler (production pipeline)
   Reads window.SITE_DATA and fills every matching [data-slot]
   element. Inlined into exported single-file sites by
   tools/export-site.ps1; the backend can reuse the same contract
   when rendering a student's live page.

   SITE_DATA shape:
   {
     theme: "ocean-calm",
     pageTitle: "Mia's World",
     slots:   { "site-title": "...", "about-me": "<p>...</p>", ... },
     images:  { "avatar": { "src": "<url|data-uri>", "alt": "..." }, ... }
   }
   Runs synchronously at end of <body>, before first paint:
   no flash of placeholder content.
   ============================================================ */
(function () {
  'use strict';

  var d = window.SITE_DATA;
  if (!d) return;

  if (d.theme) {
    document.documentElement.setAttribute('data-theme', d.theme);
  }
  if (d.pageTitle) {
    document.title = d.pageTitle;
  }

  var slots = d.slots || {};
  Object.keys(slots).forEach(function (name) {
    var el = document.querySelector('[data-slot="' + name + '"]');
    if (!el) return;
    var v = slots[name];
    /* Arrays fill list-type slots (e.g. mood-tags -> <li> items) */
    el.textContent = '';
    if (name === 'about-me') {
      var p = document.createElement('p'); p.textContent = String(v || '').replace(/^<p>/i, '').replace(/<\/p>$/i, ''); el.appendChild(p);
    } else if (Object.prototype.toString.call(v) === '[object Array]') {
      v.forEach(function(item) { var li = document.createElement('li'); li.textContent = String(item); el.appendChild(li); });
    } else {
      el.textContent = String(v || '');
    }
  });

  var images = d.images || {};
  Object.keys(images).forEach(function (name) {
    var el = document.querySelector('[data-slot="' + name + '"]');
    if (!el) return;
    var img = document.createElement('img');
    img.src = images[name].src;
    img.alt = images[name].alt || '';
    el.innerHTML = '';
    el.appendChild(img);
  });
})();
