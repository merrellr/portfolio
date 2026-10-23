/* ================================================================
   Robert Merrell — portfolio behaviour (no dependencies)
   - theme toggle, sticky nav, mobile menu, reveal-on-scroll
   - animated counters and bars
   - filter chips (Work and Resume pages)
   - "Ask" search over every page's [data-ask] blocks
   - ⌘K / Ctrl+K command palette
   ================================================================ */
(function () {
  "use strict";

  var EMAIL = "rmerrell@productadvisory.co";
  // The Google Apps Script web app that writes AI answers (apps-script/ask.gs).
  // Leave empty and Ask still works as a plain search over the site.
  var ASK_ENDPOINT = "https://script.google.com/macros/s/AKfycbzBAlOzWixhLKyIbUmMriXhLyhffOskOEdu3dpvYV0k3dMUholkhPdejv7HHaz8yUP2/exec";
  var PAGES = ["index.html", "work.html", "resume.html", "writing.html"];
  var PAGE_NAMES = { "index.html": "Home", "work.html": "Work", "resume.html": "Resume", "writing.html": "Writing" };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val);
    } catch (e) { return null; }
  }

  // The file name, whether the address is clean (/work) or not (/work.html).
  function currentPage() {
    var p = location.pathname.split("/").pop();
    return !p ? "index.html" : /\.html$/.test(p) ? p : p + ".html";
  }
  // Pages are known by file name ("work.html#id", which is also what the Ask script accepts as a source);
  // links show the clean address ("/work#id"). GitHub Pages serves work.html for /work.
  function clean(u) { return String(u).replace(/^index\.html/, "/").replace(/^([a-z-]+)\.html/, "/$1"); }

  /* ---------- analytics ----------
     Google Analytics records page views, outbound links and PDF opens on its
     own. These events cover what it can't see. Question text is never sent. */
  function track(name, params) {
    try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (e) { /* never break the page */ }
  }

  /* ---------- toast ---------- */
  var toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove("show"); }, 1800);
  }

  function copyText(text, msg) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast(msg); }, function () { toast("Select the link and copy it"); });
    else toast("Select the link and copy it");
  }

  function copyEmail() {
    track("copy_email");
    var done = function () { toast("Email copied: " + EMAIL); };
    if (navigator.clipboard) navigator.clipboard.writeText(EMAIL).then(done, function () { location.href = "mailto:" + EMAIL; });
    else location.href = "mailto:" + EMAIL;
  }

  /* ---------- theme ---------- */
  function isDark() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function toggleTheme() {
    var next = isDark() ? "light" : "dark";
    if (window.SitePrefs && window.SitePrefs.setMode) window.SitePrefs.setMode(next);
    else { document.documentElement.setAttribute("data-theme", next); store("theme", next); }
  }

  /* ---------- nav ---------- */
  function initNav() {
    var nav = $(".nav");
    if (!nav) return;
    var onScroll = function () { nav.classList.toggle("scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    var menu = $(".menu-btn");
    if (menu) menu.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      menu.setAttribute("aria-expanded", open ? "true" : "false");
    });
    $$("[data-action]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        var a = b.getAttribute("data-action");
        if (a === "theme") toggleTheme();
        if (a === "palette") openPalette();
        if (a === "copy-email") { e.preventDefault(); copyEmail(); }
        if (a === "ask") { e.preventDefault(); goAsk(""); }
      });
    });
    var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    $$(".mod-key").forEach(function (k) { k.textContent = mac ? "⌘" : "Ctrl"; });
  }

  /* ---------- reveal, counters, bars ---------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var pre = el.getAttribute("data-prefix") || "";
    var suf = el.getAttribute("data-suffix") || "";
    var start = null, dur = 1400;
    function step(ts) {
      if (!start) start = ts;
      var k = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - k, 3);
      el.textContent = pre + Math.round(target * eased) + suf;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function initReveal() {
    var reduce = (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) ||
      document.documentElement.getAttribute("data-motion") === "reduced";
    var targets = $$(".reveal, [data-count], .bar .fill");
    if (!("IntersectionObserver" in window) || reduce) {
      targets.forEach(function (el) {
        el.classList.add("in");
        if (el.classList.contains("fill")) el.style.width = el.getAttribute("data-w");
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        el.classList.add("in");
        if (el.hasAttribute("data-count")) animateCount(el);
        if (el.classList.contains("fill")) el.style.width = el.getAttribute("data-w");
        io.unobserve(el);
      });
    }, { threshold: 0.15 });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* ---------- filter chips ----------
     <div class="chips" data-filter-for="#list" data-mode="hide|dim">
       <button class="chip" data-filter="all">All</button> …
     items inside #list carry data-tags="ai data …" */
  function initFilters() {
    $$(".chips[data-filter-for]").forEach(function (bar) {
      var list = $(bar.getAttribute("data-filter-for"));
      if (!list) return;
      var mode = bar.getAttribute("data-mode") || "hide";
      var items = $$("[data-tags]", list);
      var chips = $$(".chip", bar);
      chips.forEach(function (c) {
        var f = c.getAttribute("data-filter");
        var n = f === "all" ? items.length : items.filter(function (i) { return (" " + i.getAttribute("data-tags") + " ").indexOf(" " + f + " ") > -1; }).length;
        var badge = document.createElement("span"); badge.className = "n"; badge.textContent = n; c.appendChild(badge);
        c.addEventListener("click", function () { apply(f, true); });
      });
      function apply(f, fromClick) {
        if (fromClick) track("filter", { list: bar.getAttribute("data-filter-for").slice(1), filter: f });
        chips.forEach(function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-filter") === f ? "true" : "false"); });
        items.forEach(function (i) {
          var hit = f === "all" || (" " + i.getAttribute("data-tags") + " ").indexOf(" " + f + " ") > -1;
          if (mode === "dim") i.classList.toggle("dim", !hit); else i.hidden = !hit;
        });
        $$("[data-group]", list).forEach(function (g) {
          g.hidden = mode === "hide" && !$$("[data-tags]", g).some(function (i) { return !i.hidden; });
        });
      }
      var q = new URLSearchParams(location.search).get("filter");
      apply(q && chips.some(function (c) { return c.getAttribute("data-filter") === q; }) ? q : "all");
    });
  }

  /* open a case study when its anchor is the URL hash */
  function openHash() {
    if (!location.hash) return;
    var el = document.getElementById(location.hash.slice(1));
    if (el && el.tagName === "DETAILS") { el.open = true; el.hidden = false; }
  }

  /* ================================================================
     Ask: a small search engine over every block marked [data-ask].
     Each page is fetched once, split into blocks, and ranked with a
     BM25-style score plus a few product/healthcare synonyms. Answers
     link back to the exact block. No server and nothing leaves the
     browser.
     ================================================================ */
  var STOP = "a an and are as at be been but by can could did do does for from had has have he her his how i if in into is it its me my of on or our she so than that the their them then there these they this to was we were what when where which who why will with would you your about any ever robert robert's merrell he's tell show give".split(" ");
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });
  var SYN = {
    ai: ["ml", "llm", "llms", "nlp", "machine", "learning", "model", "models", "predictive", "copilot", "agentic", "claude"],
    ml: ["ai", "machine", "learning", "model", "predictive"],
    llm: ["ai", "llms", "language", "models"],
    revenue: ["$", "revenue", "growth", "commercial", "reimbursement", "billing"],
    money: ["revenue", "$"],
    team: ["teams", "organization", "org", "hiring", "built", "leadership", "led"],
    lead: ["led", "leadership", "head", "executive", "team"],
    leadership: ["led", "head", "executive", "team", "board"],
    startup: ["startup", "founder", "ground", "vynca", "incubated"],
    interoperability: ["fhir", "hl7", "epic", "emr", "integrations", "integration"],
    integration: ["fhir", "hl7", "epic", "emr", "integrations", "interoperability"],
    emr: ["ehr", "epic", "cerner", "athena", "fhir", "hl7"],
    ehr: ["emr", "epic", "cerner"],
    epic: ["emr", "aura", "integrations"],
    compliance: ["hipaa", "soc", "hitrust", "iso", "regulatory", "governance"],
    security: ["hipaa", "soc", "hitrust", "iso"],
    data: ["analytics", "warehouse", "reporting", "bi", "governance", "dashboards"],
    analytics: ["data", "reporting", "dashboards", "bi"],
    patient: ["patients", "engagement", "consumer", "care"],
    payer: ["payor", "payers", "payors", "health plans", "aetna", "reimbursement"],
    payor: ["payer", "payers", "reimbursement"],
    cpo: ["chief", "head", "executive", "vp"],
    gtm: ["go-to-market", "launch", "commercialization", "sales"],
    launch: ["launched", "go-to-market", "gtm"],
    education: ["degree", "masters", "university", "certified", "certification"],
    built: ["build", "building", "built", "developed", "launched", "designed"],
    product: ["products", "portfolio", "platform"],
    written: ["article", "articles", "writing", "newsletter", "linkedin"],
    write: ["article", "articles", "writing", "newsletter"],
    wrote: ["article", "articles", "writing"],
    article: ["articles", "writing", "newsletter"],
    articles: ["article", "writing", "newsletter"],
    blog: ["article", "articles", "writing", "newsletter"],
    agents: ["agent", "agentic", "copilots", "ai"],
    agentic: ["agents", "agent", "copilots", "ai"]
  };
  function tokens(s) {
    return (s.toLowerCase().replace(/[’']/g, "").match(/\$|[a-z0-9][a-z0-9+\-.]*[a-z0-9]|[a-z0-9]/g) || [])
      .filter(function (t) { return !STOPSET[t]; });
  }
  function stem(t) { return t.length > 4 ? t.replace(/(ing|ed|es|s)$/, "") : t; }

  var TAG_WORDS = { ai: "ai ai ml", data: "data analytics", interop: "interoperability emr integration", patient: "patient experience",
    revenue: "revenue growth", built: "built", exec: "executive leadership", startup: "startup", payer: "payer reimbursement" };
  function tagWords(el) {
    return (el.getAttribute("data-tags") || "").split(/\s+/).map(function (t) { return TAG_WORDS[t] || ""; }).join(" ");
  }
  var KIND_WEIGHT = { "Case study": 1.3, "Experience": 1.15, "Resume": 0.9, "Writing": 0.9, "Home": 0.75 };

  var index = null, indexing = null;
  function chunksFrom(doc, page) {
    return $$("[data-ask]", doc).map(function (el) {
      var anchor = el.id ? el : el.closest("[id]");
      var title = el.getAttribute("data-ask") || ((el.querySelector("h1,h2,h3,h4") || {}).textContent || PAGE_NAMES[page]);
      // textContent, not innerText: closed <details> bodies must be searchable too
      var text = (el.textContent || "").replace(/\s+/g, " ").trim();
      return {
        title: title.trim(),
        kind: el.getAttribute("data-kind") || PAGE_NAMES[page],
        url: page + (anchor && anchor.id ? "#" + anchor.id : ""),
        text: text,
        toks: tokens(title + " " + title + " " + tagWords(el) + " " + text).map(stem)
      };
    });
  }
  function buildIndex() {
    if (index) return Promise.resolve(index);
    if (indexing) return indexing;
    var here = currentPage();
    var jobs = PAGES.map(function (p) {
      if (p === here) return Promise.resolve(chunksFrom(document, p));
      return fetch(p).then(function (r) { return r.ok ? r.text() : ""; }).then(function (html) {
        if (!html) return [];
        return chunksFrom(new DOMParser().parseFromString(html, "text/html"), p);
      }).catch(function () { return []; });
    });
    indexing = Promise.all(jobs).then(function (lists) {
      var docs = [].concat.apply([], lists);
      var df = {};
      docs.forEach(function (d) {
        var seen = {};
        d.tf = {};
        d.toks.forEach(function (t) { d.tf[t] = (d.tf[t] || 0) + 1; if (!seen[t]) { seen[t] = 1; df[t] = (df[t] || 0) + 1; } });
        d.len = d.toks.length;
      });
      var avg = docs.reduce(function (s, d) { return s + d.len; }, 0) / Math.max(1, docs.length);
      index = { docs: docs, df: df, avg: avg, n: docs.length };
      return index;
    });
    return indexing;
  }

  function search(q) {
    return buildIndex().then(function (ix) {
      var base = tokens(q);
      var terms = {};
      base.forEach(function (t) {
        terms[stem(t)] = 1;
        (SYN[t] || []).forEach(function (s) { tokens(s).forEach(function (x) { if (!terms[stem(x)]) terms[stem(x)] = 0.45; }); });
      });
      var k1 = 1.4, b = 0.7;
      var scored = ix.docs.map(function (d) {
        var s = 0, hits = 0;
        Object.keys(terms).forEach(function (t) {
          var f = d.tf[t];
          if (!f) return;
          var idf = Math.log(1 + (ix.n - ix.df[t] + 0.5) / (ix.df[t] + 0.5));
          s += terms[t] * idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / ix.avg));
          if (terms[t] === 1) hits++;
        });
        return { d: d, s: s * (1 + 0.35 * hits) * (KIND_WEIGHT[d.kind] || 1) };
      }).filter(function (r) { return r.s > 0.6; });
      scored.sort(function (a, c) { return c.s - a.s; });
      // at most one summary block from the home page, so the answers point at the detail
      // and each section once (the home page repeats some case-study titles)
      var homeSeen = false, titles = {};
      scored = scored.filter(function (r) {
        if (titles[r.d.title]) return false;
        titles[r.d.title] = 1;
        if (r.d.kind !== "Home") return true;
        if (homeSeen) return false;
        homeSeen = true; return true;
      });
      return { results: scored.slice(0, 5).map(function (r) { return r.d; }), terms: Object.keys(terms) };
    });
  }

  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function snippet(text, terms) {
    var sentences = text.split(/(?<=[.!?])\s+/);
    var best = sentences[0] || "", bestScore = -1;
    sentences.forEach(function (s) {
      var toks = tokens(s).map(stem), sc = 0;
      terms.forEach(function (t) { if (toks.indexOf(t) > -1) sc++; });
      if (/\$|\d+%/.test(s)) sc += 0.5;
      if (sc > bestScore) { bestScore = sc; best = s; }
    });
    if (best.length > 260) best = best.slice(0, 257) + "…";
    var out = esc(best);
    terms.filter(function (t) { return t.length > 2 && t !== "$"; }).forEach(function (t) {
      out = out.replace(new RegExp("\\b(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[a-z]*)", "gi"), "<mark>$1</mark>");
    });
    return out;
  }

  function initAsk() {
    var box = $("#ask");
    if (!box) return;
    var form = $(".ask-form", box), input = $("input", form), out = $(".ask-out", box);
    if (ASK_ENDPOINT) $$("[data-ai-text]").forEach(function (el) { el.textContent = el.getAttribute("data-ai-text"); });
    var seq = 0;
    function run(q) {
      q = q.trim();
      if (!q) return;
      input.value = q;
      var mine = ++seq;
      track("ask_question", { mode: ASK_ENDPOINT ? "ai" : "search" });
      search(q).then(function (r) {
        if (mine !== seq) return;
        var html = '<div class="ask-q">“' + esc(q) + '”</div>';
        if (!r.results.length) {
          out.innerHTML = html + '<p class="muted">Nothing on the site answers that directly. <a href="mailto:' + EMAIL + '">Ask Robert by email</a>.</p>';
          return;
        }
        if (ASK_ENDPOINT) html += '<div class="ask-answer" aria-busy="true"><span class="ask-ai">AI answer</span><p class="ask-thinking">Reading the sections below…</p></div>';
        html += '<div class="ask-src-label">' + (ASK_ENDPOINT ? "Sources" : "Most relevant sections") + "</div>";
        html += r.results.map(function (d, i) {
          return '<a class="ask-hit" href="' + clean(d.url) + '"><small>' + (ASK_ENDPOINT ? "[" + (i + 1) + "] " : "") + esc(d.kind) + '</small><b>' + esc(d.title) + '</b><p>' + snippet(d.text, r.terms) + '</p></a>';
        }).join("");
        out.innerHTML = html;
        out.scrollTop = 0;
        if (ASK_ENDPOINT) aiAnswer(q, r.results, mine);
      });
    }
    function aiAnswer(q, results, mine) {
      var box2 = $(".ask-answer", out);
      fetch(ASK_ENDPOINT, {
        method: "POST",
        // text/plain keeps this a "simple" request, which Apps Script accepts without a CORS preflight
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          q: q,
          cid: visitorId(),
          sources: results.map(function (d) { return { url: d.url, title: d.title, text: d.text.slice(0, 1600) }; })
        })
      }).then(function (res) { return res.json(); }).then(function (data) {
        if (mine !== seq || !box2) return;
        box2.removeAttribute("aria-busy");
        track("ask_answer", { outcome: data && data.ok ? "answered" : (data && data.error) || "error" });
        if (data && data.ok && data.answer) {
          box2.innerHTML = '<span class="ask-ai">AI answer</span>' + renderAnswer(data.answer, results) +
            '<p class="ask-fine">Written by AI from the sections below. Check the linked sources for the detail.</p>' +
            '<button type="button" class="ask-share">Copy a link to this question</button>';
          $(".ask-share", box2).addEventListener("click", function () {
            copyText(askLink(q), "Link copied. It opens this page and asks the question");
            track("share_question");
          });
        } else {
          box2.innerHTML = '<p class="ask-fine">' + (data && data.error === "daily_limit"
            ? "AI answers have reached today's limit. The most relevant sections are below."
            : "The AI answer isn't available right now. The most relevant sections are below.") + "</p>";
        }
      }).catch(function () {
        if (mine !== seq || !box2) return;
        box2.removeAttribute("aria-busy");
        box2.innerHTML = '<p class="ask-fine">The AI answer isn\'t available right now. The most relevant sections are below.</p>';
      });
    }
    form.addEventListener("submit", function (e) { e.preventDefault(); run(input.value); });
    $$(".ask-suggest button", box).forEach(function (b) { b.addEventListener("click", function () { run(b.textContent); }); });
    input.addEventListener("focus", function () { buildIndex(); }, { once: true });
    var q = new URLSearchParams(location.search).get("ask");
    if (q) {
      run(q);
      setTimeout(function () { $("#ask-section").scrollIntoView({ block: "start" }); }, 50);
    }
    box._run = run;
  }
  function askLink(q) {
    var u = new URL("./", location.href);
    u.searchParams.set("ask", q);
    return u.toString();
  }

  /* Citations like [2] or [1, 3] become links to the matching source. */
  function renderAnswer(text, results) {
    return esc(text).split(/\n{2,}/).map(function (para) {
      para = para.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, function (m, nums) {
        return nums.split(/\s*,\s*/).map(function (n) {
          var d = results[+n - 1];
          return d ? '<a class="cite" href="' + clean(d.url) + '" title="' + esc(d.title) + '">' + n + "</a>" : "";
        }).join("");
      });
      return "<p>" + para.replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }

  /* An anonymous id so the backend can apply a per-visitor daily limit. */
  function visitorId() {
    var id = store("ask_vid");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      store("ask_vid", id);
    }
    return id || "";
  }

  function goAsk(q) {
    var box = $("#ask");
    if (box) {
      box.scrollIntoView({ behavior: "smooth", block: "center" });
      var input = $("input", box);
      setTimeout(function () { input.focus(); }, 300);
      if (q && box._run) box._run(q);
    } else {
      location.href = "/?ask=" + encodeURIComponent(q || "") + "#ask";
    }
  }

  /* ================================================================
     Command palette
     ================================================================ */
  var pal, palInput, palList, palItems = [], palSel = 0, lastFocus;
  var ACTIONS = [
    { g: "Go to", t: "Home", i: "⌂", run: function () { location.href = "/"; } },
    { g: "Go to", t: "Work: case studies", i: "◆", run: function () { location.href = "/work"; } },
    { g: "Go to", t: "Resume", i: "≡", run: function () { location.href = "/resume"; } },
    { g: "Go to", t: "Writing & frameworks", i: "✎", run: function () { location.href = "/writing"; } },
    { g: "Do", t: "Copy email address", i: "@", hint: EMAIL, run: copyEmail },
    { g: "Do", t: "Open resume (PDF)", i: "↗", run: function () { window.open("assets/Robert-Merrell-Resume.pdf", "_blank", "noopener"); } },
    { g: "Do", t: "Try the PM + AI skill assessment", i: "↗", hint: "assessment.productadvisory.co", run: function () { window.open("https://assessment.productadvisory.co/", "_blank", "noopener"); } },
    { g: "Do", t: "Open LinkedIn", i: "in", run: function () { window.open("https://www.linkedin.com/in/robertmerrell/", "_blank", "noopener"); } },
    { g: "Do", t: "Subscribe to the Product+ newsletter", i: "+", run: function () { window.open("https://www.linkedin.com/build-relation/newsletter-follow?entityUrn=7391081463410196482", "_blank", "noopener"); } },
    { g: "Do", t: "Toggle light / dark", i: "◐", run: toggleTheme },
    { g: "Do", t: "Send Robert a message", i: "✉", run: function () { location.href = "/contact"; } },
    { g: "Make it yours", t: "Open all preferences", i: "⚙", run: function () { location.href = "/preferences"; } },
    { g: "Do", t: "Print the one-pager", i: "⎙", run: function () { location.href = "/one-pager"; } },
    { g: "Make it yours", t: "Style: Editorial", i: "Aa", run: function () { setPref("style", "editorial"); } },
    { g: "Make it yours", t: "Style: Boardroom", i: "Aa", run: function () { setPref("style", "boardroom"); } },
    { g: "Make it yours", t: "Style: Lab", i: "Aa", run: function () { setPref("style", "lab"); } }
  ];
  function buildPalette() {
    pal = document.createElement("div");
    pal.className = "palette-backdrop";
    pal.innerHTML = '<div class="palette" role="dialog" aria-modal="true" aria-label="Command menu">' +
      '<input type="text" placeholder="Jump to a page, a case study, or ask a question…" aria-label="Search commands" autocomplete="off">' +
      '<ul role="listbox"></ul>' +
      '<div class="foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div></div>';
    document.body.appendChild(pal);
    palInput = $("input", pal); palList = $("ul", pal);
    pal.addEventListener("click", function (e) { if (e.target === pal) closePalette(); });
    palInput.addEventListener("input", renderPalette);
    palInput.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); palSel = Math.min(palItems.length - 1, palSel + 1); markSel(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); palSel = Math.max(0, palSel - 1); markSel(); }
      else if (e.key === "Enter") { e.preventDefault(); if (palItems[palSel]) { var it = palItems[palSel]; closePalette(); it.run(); } }
      else if (e.key === "Escape") { closePalette(); }
      else if (e.key === "Tab") { e.preventDefault(); }
    });
  }
  function caseItems() {
    if (!index) return [];
    return index.docs.filter(function (d) { return d.kind !== "Home" && /#/.test(d.url) && (d.kind === "Case study" || d.kind === "Experience"); })
      .map(function (d) { return { g: d.kind === "Experience" ? "Experience" : "Case studies", t: d.title, s: d.text.slice(0, 200), i: d.kind === "Experience" ? "▸" : "◆", run: function () { location.href = clean(d.url); if (currentPage() === d.url.split("#")[0]) { location.hash = ""; location.hash = d.url.split("#")[1]; openHash(); } } }; });
  }
  function renderPalette() {
    var q = palInput.value.trim().toLowerCase();
    var all = ACTIONS.concat(caseItems());
    palItems = all.filter(function (a) { return !q || (a.t + " " + (a.hint || "") + " " + a.g + " " + (a.s || "")).toLowerCase().indexOf(q) > -1; });
    if (q) palItems.push({ g: "Ask", t: "Ask: “" + palInput.value.trim() + "”", i: "?", run: function () { goAsk(palInput.value.trim()); }, q: true });
    palSel = 0;
    var html = "", grp = "";
    palItems.forEach(function (a, n) {
      if (a.g !== grp) { grp = a.g; html += '<li class="grp" role="presentation">' + esc(grp) + "</li>"; }
      html += '<li><button type="button" role="option" data-n="' + n + '"><span class="ico">' + esc(a.i) + "</span>" + esc(a.t) + (a.hint ? "<small>" + esc(a.hint) + "</small>" : "") + "</button></li>";
    });
    palList.innerHTML = html;
    $$("button", palList).forEach(function (b) {
      b.addEventListener("click", function () { var it = palItems[+b.getAttribute("data-n")]; closePalette(); it.run(); });
      b.addEventListener("mousemove", function () { palSel = +b.getAttribute("data-n"); markSel(); });
    });
    markSel();
  }
  function markSel() {
    $$("button", palList).forEach(function (b) {
      var on = +b.getAttribute("data-n") === palSel;
      b.setAttribute("aria-selected", on ? "true" : "false");
      if (on) b.scrollIntoView({ block: "nearest" });
    });
  }
  function openPalette() {
    if (!pal) buildPalette();
    track("command_menu_open");
    lastFocus = document.activeElement;
    pal.classList.add("open");
    palInput.value = "";
    renderPalette();
    palInput.focus();
    buildIndex().then(function () { if (pal.classList.contains("open")) renderPalette(); });
  }
  function closePalette() {
    if (!pal) return;
    pal.classList.remove("open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); if (pal && pal.classList.contains("open")) closePalette(); else openPalette(); }
    else if (e.key === "/" && !/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || "") && !(pal && pal.classList.contains("open"))) { e.preventDefault(); openPalette(); }
  });

  /* ================================================================
     Preferences, the "Who's visiting?" lens, and the contact form
     ================================================================ */
  function setPref(key, value) {
    if (!window.SitePrefs) return;
    var p = window.SitePrefs.current();
    p[key] = value;
    window.SitePrefs.save(p);
    track("pref_change", { pref: key, value: value || "default" });
    syncPrefControls();
  }

  function syncPrefControls() {
    if (!window.SitePrefs) return;
    var p = window.SitePrefs.current();
    var theme = window.SitePrefs.mode();
    $$("[data-pref]").forEach(function (group) {
      var key = group.getAttribute("data-pref");
      var current = key === "theme" ? theme : p[key];
      $$("[role=radio]", group).forEach(function (b) {
        var on = b.getAttribute("data-value") === current;
        b.setAttribute("aria-checked", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
      });
    });
  }

  function initPrefs() {
    if (!$("#prefs")) return;
    $$("[data-pref]").forEach(function (group) {
      var key = group.getAttribute("data-pref");
      $$("[role=radio]", group).forEach(function (b) {
        b.addEventListener("click", function () {
          var v = b.getAttribute("data-value");
          if (key === "theme") {
            if (window.SitePrefs.shared()) window.SitePrefs.keepShared();
            window.SitePrefs.setMode(v);
            track("pref_change", { pref: "theme", value: v || "system" });
            syncPrefControls();
          } else {
            setPref(key, v);
          }
        });
      });
      radioKeys(group);
    });
    var reset = $("#prefs-reset");
    if (reset) reset.addEventListener("click", function () {
      window.SitePrefs.reset();
      window.SitePrefs.dropShared();
      track("pref_reset");
      syncPrefControls();
      toast("Back to the defaults");
    });
    var share = $("#prefs-share");
    if (share) share.addEventListener("click", function () {
      var url = window.SitePrefs.shareUrl(window.SitePrefs.current(), window.SitePrefs.mode());
      var out = $("#prefs-share-url");
      out.value = url; out.hidden = false; out.select();
      copyText(url, "Link copied. Anyone who opens it sees this look");
      track("share_look");
    });
    syncPrefControls();
  }

  /* Arrow keys move between options in a radiogroup, as screen-reader users expect. */
  function radioKeys(group) {
    group.addEventListener("keydown", function (e) {
      if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].indexOf(e.key) < 0) return;
      var radios = $$("[role=radio]", group);
      var i = radios.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      var next = radios[(i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : radios.length - 1)) % radios.length];
      next.focus(); next.click();
    });
  }

  function initLens() {
    $$("button[data-lens]").forEach(function (b) {
      b.addEventListener("click", function () { setPref("lens", b.getAttribute("data-lens")); });
    });
  }

  function initContact() {
    var form = $("#contact-form");
    if (!form) return;
    var started = Date.now();
    var reason = new URLSearchParams(location.search).get("reason");
    var rating = "";
    var reasons = $$("[data-reason]", form), ratings = $$("[data-rating]", form);
    var status = $(".form-status", form);
    function pickReason(r) {
      reason = r;
      reasons.forEach(function (b) { var on = b.getAttribute("data-reason") === r; b.setAttribute("aria-checked", on ? "true" : "false"); b.tabIndex = on || !r ? 0 : -1; });
      var fb = r === "feedback";
      $(".rating-field", form).hidden = !fb;
      $(".company-field", form).hidden = fb;
      $$(".opt", $("[name=email]", form).parentNode).forEach(function (o) { o.hidden = !fb; });
      $("[name=message]", form).placeholder = fb ? "What worked, what didn't, what you'd add…" :
        r === "hiring" ? "The role, the team, and the best way to reach you…" :
        r === "advisory" ? "What you're building and where you're stuck…" : "";
      setupAssist(r);
    }

    /* ----- "Not sure what to write?": a few quick questions, turned into a draft by AI ----- */
    var assist = $("#contact-assist", form);
    var ASSIST_COPY = {
      hiring: ["What's the role?", "For example: VP of Product for a care-coordination platform, team of 12", "What would the role focus on?"],
      advisory: ["What are you working on?", "For example: launching an AI feature for clinicians next quarter", "Where could I help?"],
      other: ["What's on your mind?", "For example: I'd love to have you on our product podcast", "What's it about?"]
    };
    function assistKind() { return reason === "hiring" || reason === "advisory" ? reason : "other"; }
    function setupAssist(r) {
      if (!assist) return;
      assist.hidden = r === "feedback";
      var k = assistKind(), copy = ASSIST_COPY[k];
      $("#a-context-label", assist).textContent = copy[0];
      $("#a-context", assist).placeholder = copy[1];
      $("#a-help-label", assist).textContent = copy[2];
      $$("[data-assist-help]", assist).forEach(function (row) { row.hidden = row.getAttribute("data-assist-help") !== k; });
      $("#a-timing-q", assist).hidden = k === "other";
    }
    function assistAnswers() {
      var k = assistKind();
      var t = $('[data-assist="timing"] [aria-checked="true"]', assist);
      return {
        reason: k,
        context: $("#a-context", assist).value.trim(),
        help: $$('[data-assist-help="' + k + '"] [aria-pressed="true"]', assist).map(function (b) { return b.getAttribute("data-value"); }),
        timing: k !== "other" && t ? t.getAttribute("data-value") : "",
        extra: $("#a-extra", assist).value.trim()
      };
    }
    // Without the AI (or if it's busy), the answers are written out plainly instead.
    function plainDraft(a) {
      var list = a.help.map(function (h) { return h.replace(/^([A-Z])(?![A-Z])/, function (c) { return c.toLowerCase(); }); })
        .join(", ").replace(/, ([^,]*)$/, " and $1");
      var when = { exploring: "We're just exploring for now.", months: "We're hoping to move in the next few months.", soon: "We'd like to move as soon as possible." }[a.timing] || "";
      var lines = a.reason === "hiring" ? [a.context && "I'm reaching out about a role: " + a.context + ".", list && "It would focus on " + list + ".", when]
        : a.reason === "advisory" ? [a.context && "I'd value your help with " + a.context + ".", list && "The areas I have in mind: " + list + ".", when]
        : [a.context && a.context + ".", list && "It's about " + list + "."];
      return lines.concat(a.extra).filter(Boolean).join(" ").replace(/\.\./g, ".");
    }
    if (assist) {
      $$(".chip", assist).forEach(function (c) {
        c.addEventListener("click", function () { c.setAttribute("aria-pressed", c.getAttribute("aria-pressed") === "true" ? "false" : "true"); });
      });
      var timings = $$('[data-assist="timing"] [role=radio]', assist);
      timings.forEach(function (b) {
        b.addEventListener("click", function () { timings.forEach(function (x) { x.setAttribute("aria-checked", x === b ? "true" : "false"); }); });
      });
      $("#a-write", assist).addEventListener("click", function () {
        var btn = this, a = assistAnswers(), out = $(".assist-status", assist), msg = $("[name=message]", form);
        if (!a.context && !a.help.length && !a.extra) { out.textContent = "Answer at least one question first."; return; }
        btn.disabled = true; out.textContent = "Writing your message…";
        var fill = function (text, ai) {
          msg.value = text.slice(0, 4000);
          btn.disabled = false;
          out.textContent = ai ? "Done. Your message is in the box above: edit anything you like." : "Your answers are in the box above: edit anything you like.";
          msg.focus();
          track("contact_draft", { ai: ai ? "yes" : "no", reason: a.reason });
        };
        if (!ASK_ENDPOINT) return fill(plainDraft(a), false);
        fetch(ASK_ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ type: "draft", reason: a.reason, context: a.context, help: a.help, timing: a.timing, extra: a.extra, company: $("[name=company]", form).value.trim(), cid: visitorId() }) })
          .then(function (r) { return r.json(); })
          .then(function (r) { if (r && r.ok && r.text) fill(r.text, true); else fill(plainDraft(a), false); })
          .catch(function () { fill(plainDraft(a), false); });
      });
    }
    reasons.forEach(function (b) { b.addEventListener("click", function () { pickReason(b.getAttribute("data-reason")); }); });
    ratings.forEach(function (b) {
      b.addEventListener("click", function () {
        rating = b.getAttribute("data-rating");
        ratings.forEach(function (x) { x.setAttribute("aria-checked", x === b ? "true" : "false"); });
      });
    });
    $$("[role=radiogroup]", form).forEach(radioKeys);
    pickReason(reasons.some(function (b) { return b.getAttribute("data-reason") === reason; }) ? reason : "");

    function field(n) { return $("[name=" + n + "]", form); }
    function say(msg, err) { status.textContent = msg; status.classList.toggle("err", !!err); }
    function mailtoLink(d) {
      var body = d.message + "\n\n" + (d.name || "") + (d.company ? "\n" + d.company : "");
      return "mailto:" + EMAIL + "?subject=" + encodeURIComponent("Portfolio: " + (d.reasonLabel || "Hello")) + "&body=" + encodeURIComponent(body);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = {
        type: "contact", reason: reason || "other", rating: rating,
        name: field("name").value.trim(), email: field("email").value.trim(), company: field("company").value.trim(),
        message: field("message").value.trim(), website: field("website").value, elapsed: Date.now() - started
      };
      var picked = reasons.filter(function (b) { return b.getAttribute("data-reason") === d.reason; })[0];
      d.reasonLabel = picked ? picked.textContent : "Something else";
      ["email", "message"].forEach(function (n) { field(n).removeAttribute("aria-invalid"); });
      if (!d.message) { field("message").setAttribute("aria-invalid", "true"); field("message").focus(); return say("Please add a message.", true); }
      var needEmail = d.reason !== "feedback";
      if ((needEmail && !d.email) || (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))) {
        field("email").setAttribute("aria-invalid", "true"); field("email").focus();
        return say(d.email ? "That email address doesn't look right." : "Please add your email so I can reply.", true);
      }
      if (!ASK_ENDPOINT) { location.href = mailtoLink(d); return; }
      var btn = $("button[type=submit]", form);
      btn.disabled = true; say("Sending…");
      fetch(ASK_ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(d) })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (!res || !res.ok) throw new Error((res && res.error) || "failed");
          track("contact_submit", { reason: d.reason });
          form.innerHTML = '<div class="sent"><h3>Thanks' + (d.name ? ", " + esc(d.name.split(" ")[0]) : "") + '.</h3><p>' +
            (d.reason === "feedback" ? "Your feedback is on its way to me. It helps make this site better." : "Your message is on its way to my inbox, and I'll reply to " + esc(d.email) + ". You'll also get a short confirmation by email.") +
            '</p><a class="btn ghost" href="/">Back to the home page</a></div>';
        })
        .catch(function () {
          btn.disabled = false;
          status.innerHTML = 'That didn\'t send. <a href="' + esc(mailtoLink(d)) + '">Email it instead</a>; your message will be filled in.';
          status.classList.add("err");
        });
    });
  }

  var STYLE_NAMES = { editorial: "Editorial", boardroom: "Boardroom", lab: "Lab" };
  var LENS_NAMES = { recruiter: "recruiter view", hiring: "hiring manager view", product: "product manager view" };
  function initSharedBar() {
    var sp = window.SitePrefs, s = sp && sp.shared();
    if (!s) return;
    // A link that only sets the lens (e.g. ?lens=recruiter sent to a recruiter) needs no bar.
    var looks = Object.keys(s.prefs).filter(function (k) { return k !== "lens"; });
    if (!looks.length && !s.mode) return;
    var p = sp.current(), bits = [];
    if (s.prefs.style) bits.push(STYLE_NAMES[p.style]);
    if (s.prefs.accent) bits.push(p.accent.charAt(0).toUpperCase() + p.accent.slice(1));
    if (s.mode) bits.push(s.mode === "dark" ? "Dark" : "Light");
    if (s.prefs.lens) bits.push(LENS_NAMES[p.lens]);
    var bar = document.createElement("div");
    bar.className = "shared-bar"; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", "Shared look");
    bar.innerHTML = '<span>You\'re seeing a shared look' + (bits.length ? ": <b>" + esc(bits.join(" · ")) + "</b>" : "") + '.</span>' +
      '<button type="button" class="btn" data-k="keep">Keep it</button><button type="button" class="btn ghost" data-k="drop">Use my own</button>';
    document.body.appendChild(bar);
    bar.addEventListener("click", function (e) {
      var k = e.target.getAttribute && e.target.getAttribute("data-k");
      if (!k) return;
      if (k === "keep") { sp.keepShared(); toast("Saved as your look"); } else { sp.dropShared(); }
      track("shared_look", { action: k });
      bar.remove();
      syncPrefControls();
    });
  }

  /* ---------- cookie consent banner ----------
     consent.js (in <head>) sets Google Consent Mode defaults by region and
     decides whether this visitor needs asking: no saved choice and a device
     time zone in Europe. A choice is remembered; "Cookie settings" reopens it. */
  function initConsent() {
    var C = window.PAConsent;
    if (!C) return;
    var bar;
    function close() { if (bar) { bar.remove(); bar = null; document.body.classList.remove("has-consent"); } }
    function show() {
      if (bar) return;
      if (C.privacySignal && C.privacySignal()) { toast("Your browser asks sites not to track you, so analytics cookies stay off"); return; }
      var cur = C.choice();
      bar = document.createElement("div");
      bar.className = "consent"; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", "Cookies and analytics");
      bar.innerHTML = '<div class="consent-text"><b>Cookies and analytics</b><p>I use Google Analytics to see which pages are used, so I can improve this site. It sets cookies on your device. It isn\'t used for advertising. <a href="https://www.productadvisory.co/privacy-policy#cookies" target="_blank" rel="noopener">Privacy Policy</a></p>' +
        (cur ? '<p class="consent-now">Your current choice: ' + (cur === "granted" ? "Accepted" : "Declined") + ".</p>" : "") + "</div>" +
        '<div class="btn-row"><button type="button" class="btn" data-c="granted">Accept</button><button type="button" class="btn ghost" data-c="denied">Decline</button></div>';
      document.body.appendChild(bar);
      document.body.classList.add("has-consent");
      bar.addEventListener("click", function (e) {
        var v = e.target.getAttribute && e.target.getAttribute("data-c");
        if (!v) return;
        C.set(v);
        close();
        toast(v === "granted" ? "Thanks. Analytics cookies are on" : "Analytics cookies are off");
      });
    }
    $$("[data-action=cookies]").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); show(); }); });
    if (C.needsPrompt()) show();
  }

  /* ---------- go ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initFilters();
    openHash();
    initReveal();
    initAsk();
    initPrefs();
    initLens();
    initContact();
    initSharedBar();
    initConsent();
    $$("details.case").forEach(function (d) {
      d.addEventListener("toggle", function () { if (d.open) track("case_study_open", { case_id: d.id }); });
    });
    var y = $("#year"); if (y) y.textContent = new Date().getFullYear();
  });
  window.addEventListener("hashchange", openHash);
})();
