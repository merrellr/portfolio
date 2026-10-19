/* ================================================================
   Applies the visitor's saved preferences before the page paints, so
   there is no flash of the default look. Loaded in <head> on every
   page, without defer. Preferences live only in this browser.

   Shared looks: any page URL can carry readable settings, e.g.
     ?style=lab&accent=plum&mode=dark      a look someone shared
     ?lens=recruiter                       open with the recruiter card
   They apply for this visit only (sessionStorage) until the visitor
   chooses to keep them; site.js shows the Keep / Use my own bar.
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
  var MODES = ["light", "dark"];
  // Extra fonts only for the styles that need them.
  var FONTS = {
    boardroom: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Serif:ital,wght@0,500;1,500&display=swap"
  };

  function get(store, key) { try { return window[store].getItem(key); } catch (e) { return null; } }
  function set(store, key, val) {
    try { if (val === null) window[store].removeItem(key); else window[store].setItem(key, val); } catch (e) { /* storage blocked */ }
  }
  function clean(p) {
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = p && CHOICES[k].indexOf(p[k]) > -1 ? p[k] : DEFAULTS[k]; });
    return out;
  }
  function parse(json) { try { return JSON.parse(json || "null"); } catch (e) { return null; } }

  /* ---- the look shared across productadvisory.co sites ----
     www.productadvisory.co, assessment.productadvisory.co and the portfolio keep the
     visitor's look in one preference cookie on .productadvisory.co ("pa_look"), so a
     choice made on one site opens the others the same way. Only the settings that
     change are written. No personal data. */
  var LOOK = "pa_look";
  function lookDomain() {
    var h = location.hostname;
    return h === "productadvisory.co" || /\.productadvisory\.co$/.test(h) ? "productadvisory.co" : "";
  }
  function readLook() {
    var m = (document.cookie || "").match(/(?:^|;\s*)pa_look=([^;]*)/);
    var v = m ? parse(decodeURIComponent(m[1])) : null;
    if (!v && !lookDomain()) v = parse(get("localStorage", LOOK));
    return v && typeof v === "object" ? v : null;
  }
  function writeLook(changes) {
    var keys = Object.keys(changes);
    if (!keys.length) return;
    var v = readLook() || {};
    keys.forEach(function (k) { v[k] = changes[k]; });
    var d = lookDomain();
    if (d) {
      try { document.cookie = LOOK + "=" + encodeURIComponent(JSON.stringify(v)) + "; Domain=" + d + "; Path=/; Max-Age=31536000; SameSite=Lax; Secure"; } catch (e) { /* cookies blocked */ }
    } else set("localStorage", LOOK, JSON.stringify(v));
  }
  function clearLook() {
    var d = lookDomain();
    if (d) { try { document.cookie = LOOK + "=; Domain=" + d + "; Path=/; Max-Age=0; SameSite=Lax; Secure"; } catch (e) { /* ignore */ } }
    else set("localStorage", LOOK, null);
  }
  // The portfolio's styles differ from productadvisory.co's, so style stays its own.
  var SHARED = ["accent", "text", "density", "motion"];

  /** The visitor's own saved choices. */
  function read() {
    var p = parse(get("localStorage", "prefs")) || {}, look = readLook();
    if (look) SHARED.forEach(function (k) { if (k in look && CHOICES[k].indexOf(look[k]) > -1) p[k] = look[k]; });
    return clean(p);
  }

  /** A look shared through the URL (this visit only), or null. */
  function shared() { return parse(get("sessionStorage", "sharedLook")); }

  /** What the page should show right now. */
  function current() {
    var s = shared();
    if (!s) return read();
    var base = read(), out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = k in s.prefs ? s.prefs[k] : base[k]; });
    return clean(out);
  }

  function mode() {
    var s = shared();
    if (s && s.mode) return s.mode;
    var look = readLook();
    if (look && "mode" in look) return MODES.indexOf(look.mode) > -1 ? look.mode : "";
    var t = get("localStorage", "theme");
    return MODES.indexOf(t) > -1 ? t : "";
  }

  function apply(p) {
    var root = document.documentElement;
    Object.keys(DEFAULTS).forEach(function (k) {
      if (p[k] && p[k] !== DEFAULTS[k]) root.setAttribute("data-" + k, p[k]);
      else root.removeAttribute("data-" + k);
    });
    if (FONTS[p.style] && !document.getElementById("font-" + p.style)) {
      var l = document.createElement("link");
      l.rel = "stylesheet"; l.href = FONTS[p.style]; l.id = "font-" + p.style;
      document.head.appendChild(l);
    }
    var m = mode();
    if (m) root.setAttribute("data-theme", m); else root.removeAttribute("data-theme");
  }

  /** Saving your own choice replaces any shared look. */
  function save(p) {
    var before = read(), after = clean(p), changes = {};
    SHARED.forEach(function (k) { if (after[k] !== before[k]) changes[k] = after[k]; });
    writeLook(changes);
    set("sessionStorage", "sharedLook", null);
    set("localStorage", "prefs", JSON.stringify(after));
    apply(current());
  }

  function keepShared() {
    var s = shared();
    if (!s) return;
    var p = current();
    if (s.mode) { set("localStorage", "theme", s.mode); writeLook({ mode: s.mode }); }
    save(p);
  }

  /** Light, dark, or "" to follow the device. Saved here and shared with the other sites. */
  function setMode(m) {
    if (shared()) keepShared();
    set("localStorage", "theme", MODES.indexOf(m) > -1 ? m : null);
    writeLook({ mode: MODES.indexOf(m) > -1 ? m : "" });
    apply(current());
  }

  /** Back to the defaults here and on the other sites. */
  function reset() {
    set("localStorage", "prefs", null);
    set("localStorage", "theme", null);
    clearLook();
    dropShared();
  }

  function dropShared() {
    set("sessionStorage", "sharedLook", null);
    apply(current());
  }

  /** A link to this site with the given look, leaving out anything at its default. */
  function shareUrl(p, m, base) {
    var u = new URL(base || "./", location.href);
    Object.keys(DEFAULTS).forEach(function (k) { if (p[k] && p[k] !== DEFAULTS[k]) u.searchParams.set(k, p[k]); });
    if (m) u.searchParams.set("mode", m);
    return u.toString();
  }

  // Pick up a look from the URL, then tidy the address bar so reloads and
  // copied links don't keep re-applying it.
  (function fromUrl() {
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { return; }
    var found = {}, any = false, m = "";
    Object.keys(DEFAULTS).forEach(function (k) {
      if (q.has(k) && CHOICES[k].indexOf(q.get(k)) > -1) { found[k] = q.get(k); any = true; q.delete(k); }
    });
    if (q.has("mode") && MODES.indexOf(q.get("mode")) > -1) { m = q.get("mode"); any = true; q.delete("mode"); }
    if (!any) return;
    set("sessionStorage", "sharedLook", JSON.stringify({ prefs: found, mode: m }));
    try {
      var rest = q.toString();
      history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
    } catch (e) { /* fine: the look still applies */ }
  })();

  window.SitePrefs = {
    DEFAULTS: DEFAULTS, CHOICES: CHOICES,
    read: read, current: current, shared: shared, mode: mode,
    save: save, setMode: setMode, reset: reset, apply: apply, keepShared: keepShared, dropShared: dropShared, shareUrl: shareUrl
  };
  apply(current());
})();
