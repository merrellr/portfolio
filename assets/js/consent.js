/* ================================================================
   Cookie consent (Google Consent Mode v2). Loaded in <head> before
   the Google Analytics snippet, without defer, so the defaults are set
   first. The same rules as www.productadvisory.co.

   By location:
   - EEA, UK and Switzerland: Google Analytics runs without cookies
     until the visitor clicks Accept. Google applies this from the
     visitor's IP address (the `region` default below).
   - Everywhere else: Analytics is on by default.
   The banner (site.js) only appears where it's needed: no saved choice,
   and a device time zone in Europe. A saved choice, Accept or Decline,
   is remembered in this browser and the banner is never shown again;
   "Cookie settings" in the footer lets anyone change it.
   Do Not Track or Global Privacy Control: analytics cookies stay off and
   the banner never shows. Advertising storage is always denied.
   ================================================================ */
(function () {
  "use strict";
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  var KEY = "pa_consent";
  // EEA (EU + Iceland, Liechtenstein, Norway), UK and Switzerland
  var STRICT = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU",
    "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH"];
  var NO_ADS = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };

  function withAds(o) { for (var k in NO_ADS) o[k] = NO_ADS[k]; return o; }

  // A region-specific default always wins over the general one for visitors in that region.
  gtag("consent", "default", withAds({ analytics_storage: "granted" }));
  gtag("consent", "default", withAds({ analytics_storage: "denied", region: STRICT, wait_for_update: 500 }));

  function read() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY) || "null");
      return c && (c.v === "granted" || c.v === "denied") ? c : null;
    } catch (e) { return null; }
  }

  /** Time zone as a stand-in for location, to decide whether to ask. Errs towards asking. */
  function inStrictZone() {
    var tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return false; }
    if (/^Europe\/(Moscow|Minsk|Kaliningrad|Samara|Ulyanovsk|Saratov|Volgograd|Kirov|Astrakhan|Istanbul)$/.test(tz)) return false;
    return /^Europe\//.test(tz) ||
      /^(Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe)|Asia\/(Nicosia|Famagusta)|Arctic\/Longyearbyen)$/.test(tz);
  }

  // Do Not Track or Global Privacy Control: analytics cookies stay off and the visitor is never asked.
  function privacySignal() {
    var n = navigator || {};
    return n.doNotTrack === "1" || n.doNotTrack === "yes" || window.doNotTrack === "1" || n.globalPrivacyControl === true;
  }

  var saved = read();
  if (privacySignal()) gtag("consent", "update", { analytics_storage: "denied" });
  else if (saved) gtag("consent", "update", { analytics_storage: saved.v });

  window.PAConsent = {
    choice: function () { var c = read(); return c ? c.v : ""; },
    privacySignal: privacySignal,
    needsPrompt: function () { return !privacySignal() && !read() && inStrictZone(); },
    set: function (v) {
      v = v === "granted" ? "granted" : "denied";
      try { localStorage.setItem(KEY, JSON.stringify({ v: v, t: new Date().toISOString().slice(0, 10) })); } catch (e) { /* storage blocked: applies to this page only */ }
      gtag("consent", "update", { analytics_storage: privacySignal() ? "denied" : v });
      window.dataLayer.push({ event: "consent_update", analytics_consent: v });
    }
  };
})();
