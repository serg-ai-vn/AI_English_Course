/* Shell preference only: deliberately independent of account and lesson state. */
(function () {
  'use strict';
  var key = 'aiEnglishCourse.uiTheme.v1';
  function normalize(id) {
    return id === 'night-lab' ? id : 'classroom-light';
  }
  function apply(id) {
    document.documentElement.setAttribute('data-ui-theme', id);
    return id;
  }
  var saved;
  try { saved = localStorage.getItem(key); } catch (_) { /* Storage may be blocked. */ }
  apply(normalize(saved));
  window.PlatformTheme = Object.freeze({
    setTheme: function (id) {
      var theme = apply(normalize(id));
      try { localStorage.setItem(key, theme); } catch (_) { /* Keep the usable in-page choice. */ }
      return theme;
    }
  });
}());
