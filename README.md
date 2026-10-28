# portfolio

Robert Merrell's portfolio, served at **https://portfolio.productadvisory.co** with GitHub Pages.

Plain HTML, CSS and JavaScript, with no build step and no dependencies. To change the content, edit the page.

| Page | File |
| --- | --- |
| Home | `index.html` |
| Work (case studies) | `work.html` |
| Resume | `resume.html` (+ `assets/Robert-Merrell-Resume.pdf`) |
| Writing & frameworks | `writing.html` |
| Contact form | `contact.html` (posts to the same Apps Script as Ask) |
| Make it yours (preferences) | `preferences.html` |
| One-page summary for printing | `one-pager.html` (fits one US Letter page; QR code in `assets/img/qr.svg`) |
| Old Google Sites links (`/home`, `/resume`, `/portfolio`, `/blog`) | `404.html` redirects them |

Pages are files (`work.html`), but every link, canonical tag and the sitemap use the clean address (`/work`, and `/`
for the home page); GitHub Pages serves `work.html` for `/work`. Old `.html` links still work, and `prefs.js` shows
them as the clean address. Inside `site.js` pages are still known by file name (the Ask script accepts sources such
as `work.html#id`), and `clean()` turns those into links.

## How things work

- **Styles:** `assets/css/site.css`. Colours are tokens at the top of the file, and dark mode redefines them.
- **Behaviour:** `assets/js/site.js`, which handles the theme toggle, mobile menu, counters, filter chips, the
  **Ask** search and the **⌘K command menu**.
- **Ask / ⌘K content:** any element with a `data-ask="Title"` attribute is searchable, on any page.
  `data-kind="Case study"` or `data-kind="Experience"` also lists it in the command menu. To add a case study,
  copy a `<details class="card case">` block in `work.html`, give it a unique `id`, and set its
  `data-tags` (`ai data interop patient revenue built`) so the filter chips pick it up.
- **Resume filters:** each `<article class="role">` in `resume.html` has `data-tags`
  (`ai exec startup interop revenue payer`).

## Make it yours (preferences)

`assets/js/prefs.js` runs in the `<head>` of every page, before anything is drawn. It reads the visitor's choices
from local storage and sets attributes on `<html>`: `data-style` (editorial, boardroom or lab), `data-accent`,
`data-text`, `data-density`, `data-motion` and `data-lens`. `site.css` does the rest with custom properties, with
light and dark versions of each style and accent. The "Who's visiting?" lens shows a matching "Start here" card on
the home page. New pages must include `<script src="assets/js/prefs.js"></script>` right after the stylesheet.

**Shared with productadvisory.co:** accent, text size, density, motion and colour mode are also kept in a preference
cookie on `.productadvisory.co` (`pa_look`) that www.productadvisory.co and assessment.productadvisory.co use too, so
a look chosen on one site opens the others the same way. Style stays the portfolio's own. Only changed settings are
written; "Reset everything" clears it.

### Links that carry a look, a view or a question

Any page URL can carry settings. They apply for that visit only, and the visitor can keep them or go back to
their own (a bar at the bottom offers both). Links that only set `lens` show no bar.

| Link | What it does |
| --- | --- |
| `/?lens=recruiter` | Opens with the recruiter "Start here" card (also `hiring`, `product`) |
| `/?style=lab&accent=plum&mode=dark` | A shared look (`style`, `accent`, `text`, `density`, `motion`, `mode`) |
| `/?ask=Has he integrated with Epic` | Scrolls to Ask and answers that question |

Make it yours has a **Share this look** button, and each AI answer has **Copy a link to this question**.

## Contact form

`contact.html` posts `{type: "contact", …}` to the same Apps Script web app as Ask (`ASK_ENDPOINT`). The script
saves the message to the **Messages** tab and emails it to rmerrell@productadvisory.co (`NOTIFY_EMAIL_`), with
Reply-To set to the sender. Emails go out from rmerrell@ (`SENDER_EMAIL_`) when the account that owns the script has
it as a "Send mail as" address; otherwise from that account's own address, with Reply-To rmerrell@. Run
`testContactEmail` after any change: its log says which address it sent from. Spam protection: a hidden honeypot field, a three-second minimum before sending, and 25 messages a day.
If the script can't be reached, the form offers a pre-filled email instead.

**Blocking a sender.** Add the script property `BLOCKED_SENDERS` (Apps Script → Project Settings → Script properties) with addresses or whole domains, separated by commas, e.g. `someone@example.com, @spam-domain.com`. A blocked sender still sees "sent", but nothing is emailed to anyone (no notice, no thank-you); the message is only kept on the **Messages** tab with "blocked" in the last column. No code change or redeploy is needed.

## Analytics and sharing

- **Cookie consent:** `assets/js/consent.js` loads just before the Google Analytics snippet and sets Google Consent
  Mode v2 defaults, the same rules as www.productadvisory.co: analytics cookies are off until Accept for visitors in
  the EEA, UK and Switzerland (Google applies this by IP) and on elsewhere; advertising storage is always denied, and
  Do Not Track or Global Privacy Control keep cookies off. A banner (`site.js`) appears only when there is no saved
  choice and the device time zone is in Europe. Accept or Decline is saved in `localStorage` (`pa_consent`) and never
  asked again; **Cookie settings** in the footer reopens it. New pages need the `consent.js` tag above the GA snippet.
- **Google Analytics 4** (`G-62QKHPVHCM`) is in the `<head>` of every page. Besides page views, outbound
  links and PDF opens, which GA records automatically, `site.js` sends these events: `ask_question`, `ask_answer`
  (outcome), `case_study_open` (case_id), `filter` (list, filter), `command_menu_open` and `copy_email`.
  Question text is never sent to GA.
- **Browser caching:** every stylesheet and script link carries `?v=<hash of the file>`. After editing anything in
  `assets/css` or `assets/js`, run `python3 tools/version-assets.py` so visitors get the new file at once.
- **Link previews:** `assets/img/og.png` (1200×630) is the image LinkedIn and others show when the site is shared.
- **Search engines:** `sitemap.xml` and `robots.txt`. Submit the sitemap in Google Search Console.
- The footer year is set by `site.js` from the visitor's clock, so it updates on its own every January.

## Turning on AI answers for Ask

Ask always searches the site in the visitor's browser. When `ASK_ENDPOINT` at the top of `assets/js/site.js`
is set, it also sends the question and the five best-matching sections to a small Google Apps Script
(`apps-script/ask.gs`). That script asks Groq to write a two-to-four-sentence answer using only those sections,
with numbered citations. If the script is unavailable or over its daily limit, Ask quietly falls back to
search results.

One-time setup:
1. Create a new Google Sheet named **Portfolio Ask log** (it also stores contact-form messages), then open **Extensions → Apps Script**.
2. Replace the contents of `Code.gs` with `apps-script/ask.gs` and save.
3. **Project Settings** (gear icon) → **Script properties** → add `GROQ_API_KEY` with your Groq key.
4. **Deploy → New deployment** → type **Web app** → Execute as **Me**, Who has access **Anyone** → **Deploy**,
   and approve the permissions. Copy the **Web app URL** (ends in `/exec`).
5. Paste that URL into `ASK_ENDPOINT` in `assets/js/site.js` and push.

Every question is logged to the sheet's **Questions** tab: time, question, sections used and outcome. Limits
are 60 answers a day overall and 8 per visitor (see the top of `ask.gs`). Ask uses `openai/gpt-oss-20b`,
a different model from the assessment's grader, so the two don't share Groq's per-model daily limits.

To change the script later, paste the new version, then **Deploy → Manage deployments → pencil → Version:
New version → Deploy**. The URL stays the same.

## Preview locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Ask needs to run over http so it can read the other pages.

## Deploy

GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root. Preview at https://merrellr.github.io/portfolio/.

To go live on the custom domain:
1. At the DNS provider for `productadvisory.co`, change the `portfolio` record to a `CNAME` pointing to `merrellr.github.io`.
2. In Settings → Pages → Custom domain, enter `portfolio.productadvisory.co` and save. GitHub commits a `CNAME` file.
3. Once the certificate is issued, tick **Enforce HTTPS**.
