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

  /* ---------------------------------------------------------------- PostHog (product analytics)
     The same block is in analytics.js (assessment.productadvisory.co) and in assets/js/consent.js on
     www.productadvisory.co and portfolio.productadvisory.co: keep the three in step. It only ever starts when Google
     Analytics may (the same consent rules), and only once POSTHOG_KEY is filled in.
     - One project for all three sites, so a visit from the website into the assessment is one journey.
     - Profiles only for people who sign in, and then only by their account id (never a name or email).
     - Session replays hide everything typed (assessment answers, notes, forms) and anything marked data-ph-mask.
     - Addresses are cleaned as for Google: only harmless parameters (course, lesson, tool, src...) are kept, and an
       invitation token, a company id or an email in an address never leaves the browser.
     - Errors in the page are recorded, so a broken page shows up before someone has to report it. */
  var POSTHOG_KEY = 'phc_AaB4m6YugNZr7NzSWm5S5UshH2HiSudnPztfa5Tkia2k';                              // the project key from PostHog (starts phc_). Public by design. Empty: off.
  var POSTHOG_HOST = 'https://us.i.posthog.com';     // the EU cloud is https://eu.i.posthog.com
  var PH_KEEP = ['course', 'lesson', 'src', 'who', 'call', 'tool'];
  // Text hidden in session replays: names, emails and personal details, wherever they appear.
  var PH_MASK = '[data-ph-mask], .pa-acct-who, .home-hello, #profileName, #profileEmail, #detailsView, #signinList';
  var PH_URL_PROPS = ['$current_url', '$referrer', '$initial_referrer', '$initial_current_url', '$session_entry_url', '$session_entry_referrer'];

  // One address with only the allowed parameters kept; another site's address is cut to its page.
  function phCleanUrl(u) {
    var x;
    try { x = new URL(String(u)); } catch (e) { return u; }
    if (!/(^|\.)productadvisory\.co$/.test(x.hostname)) return x.origin + x.pathname;
    var parts = [];
    PH_KEEP.forEach(function (k) {
      var v = x.searchParams.get(k);
      if (v !== null && /^[A-Za-z0-9_-]{1,40}$/.test(v)) parts.push(k + '=' + v);
    });
    return x.origin + x.pathname + (parts.length ? '?' + parts.join('&') : '');
  }
  function phCleanProps(p) {
    if (!p || typeof p !== 'object') return;
    PH_URL_PROPS.forEach(function (k) { if (typeof p[k] === 'string' && /^https?:/.test(p[k])) p[k] = phCleanUrl(p[k]); });
  }
  function phCleanEvent(ev) {
    if (!ev) return ev;
    phCleanProps(ev.properties);
    phCleanProps(ev.$set);
    phCleanProps(ev.$set_once);
    return ev;
  }

  // Loads PostHog the way its own snippet does: calls made before it arrives are queued and replayed.
  function phStart(win) {
    if (!POSTHOG_KEY || win.__paPH) return false;
    win.__paPH = true;
    var ph = win.posthog = win.posthog && win.posthog.__SV ? win.posthog : [];
    if (!ph.__SV) {
      ph._i = [];
      'capture identify reset opt_in_capturing opt_out_capturing has_opted_out_capturing register unregister set_config captureException startSessionRecording stopSessionRecording'
        .split(' ').forEach(function (m) { ph[m] = function () { ph.push([m].concat(Array.prototype.slice.call(arguments))); }; });
      ph.__SV = 1;
    }
    ph._i.push([POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      ui_host: POSTHOG_HOST.replace('.i.posthog.com', '.posthog.com'),
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      capture_exceptions: true,
      respect_dnt: true,
      disable_surveys: true,
      session_recording: { maskAllInputs: true, maskTextSelector: PH_MASK },
      before_send: phCleanEvent
    }, 'posthog']);
    var s = win.document.createElement('script');
    s.type = 'text/javascript'; s.crossOrigin = 'anonymous'; s.async = true;
    s.src = POSTHOG_HOST.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js';
    win.document.head.appendChild(s);
    return true;
  }
  // After a yes: start it, or turn it back on if it was switched off.
  function phGrant(win) { if (win.__paPH) { try { win.posthog.opt_in_capturing(); } catch (e) { /* not loaded */ } } else phStart(win); }
  // After a no: stop recording on this page; it won't load next time.
  function phDeny(win) { if (win.__paPH) { try { win.posthog.opt_out_capturing(); } catch (e) { /* not loaded */ } } }

  // PostHog follows the same choice as Google Analytics. Never on a test server, and never inside Learning (an
  // embedded tool is counted there, as part of that visit).
  function phOk() {
    if (!POSTHOG_KEY || privacySignal()) return false;
    if (/^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|\.test$/.test(location.hostname)) return false;
    return !(window.self !== window.top && /(?:^|&)embed=1(?:&|$)/.test(location.search.slice(1)));
  }
  if (phOk()) {
    var phChoice = read();
    if (phChoice ? phChoice.v === "granted" : !inStrictZone()) phStart(window);
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
      if (v === "granted" && phOk()) phGrant(window); else phDeny(window);
      window.dataLayer.push({ event: "consent_update", analytics_consent: v });
    }
  };
})();
