/* ================================================================
   Applies the visitor's saved preferences before the page paints, so
   there is no flash of the default look. Loaded in <head> on every
   page, without defer. Preferences live only in this browser.
   ================================================================ */
(function () {
  "use strict";
  var DEFAULTS = { style: "editorial", accent: "", text: "m", density: "comfortable", motion: "full", lens: "" };
  var CHOICES = {
    style: ["editorial", "boardroom", "lab"],
    accent: ["", "green", "blue", "plum", "coral", "gold"],
    text: ["s", "m", "l", "xl"],
    density: ["comfortable", "compact"],
    motion: ["full", "reduced"],
    lens: ["", "recruiter", "hiring", "product"]
  };
  // Extra fonts only for the styles that need them.
  var FONTS = {
    boardroom: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Serif:ital,wght@0,500;1,500&display=swap"
  };

  function read() {
    var p = {};
    try { p = JSON.parse(localStorage.getItem("prefs") || "{}") || {}; } catch (e) { p = {}; }
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = CHOICES[k].indexOf(p[k]) > -1 ? p[k] : DEFAULTS[k]; });
    return out;
  }

  function apply(p) {
    var root = document.documentElement;
    ["style", "accent", "text", "density", "motion", "lens"].forEach(function (k) {
      if (p[k] && p[k] !== DEFAULTS[k]) root.setAttribute("data-" + k, p[k]);
      else root.removeAttribute("data-" + k);
    });
    if (FONTS[p.style] && !document.getElementById("font-" + p.style)) {
      var l = document.createElement("link");
      l.rel = "stylesheet"; l.href = FONTS[p.style]; l.id = "font-" + p.style;
      document.head.appendChild(l);
    }
    try {
      var t = localStorage.getItem("theme");
      if (t === "light" || t === "dark") root.setAttribute("data-theme", t);
    } catch (e) { /* storage blocked: system theme */ }
  }

  function save(p) {
    try { localStorage.setItem("prefs", JSON.stringify(p)); } catch (e) { /* still applied for this page view */ }
    apply(p);
  }

  window.SitePrefs = { DEFAULTS: DEFAULTS, CHOICES: CHOICES, read: read, save: save, apply: apply };
  apply(read());
})();
