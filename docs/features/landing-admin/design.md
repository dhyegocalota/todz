# Landing admin: design

**Author:** `frontend-designer`, 2026-11-25. **Spec:** [spec.md](spec.md). **Sources:** [landing design](../landing/design.md), `apps/api/src/site/site-style.ts` (every token below exists there today), `site-shell.ts`, `landing-page.ts`, `landing-copy.ts`, the mail layout in `apps/api/scripts/emails/` (`email-layout.ts`, `email-style.ts`, `sign-in-template.ts`, `sign-in-email-copy.ts`).

**Before state.** `/admin` is not served today (spec, Rollback: it "becomes the site's 404"), so there is no flow to walk or screenshot; the before shot of the PR is "no page". The ASCII layouts below stand in for mockups; the recorder shoots the real pages at 1280 and 375, light and dark, in the PR.

**Stance.** The admin is one owner on one page: quiet, small, no motion beyond the landing's single rise. It adds no colour, no token, no font, no image and no glyph. Everything is the landing's glass card, capsule field, gradient button, type scale and tokens, under the same `siteDocumentHtml` shell. Light first; dark is the token switch already in `SITE_STYLE`, never per-component colour.

## 1. Shared anatomy

### Shell

Every admin page is `siteDocumentHtml` (skip link, sticky glass header, `main#content`, footer, `lang="en"`, both `theme-color` metas). Two changes, both optional parameters so the landing renders byte-for-byte as today:

- **Header nav slot.** The shell's nav carries the "Self-host guide" link for the public pages. Admin pages replace it: nothing on the sign-in screens, the Sign out form on the panel (option P).
- **Robots and cache** are headers, not shell (spec, Interfaces); the shell adds nothing.

The brand link keeps pointing at `/` (the landing); the owner reaches the panel by `/admin`. The footer stays (brand, © todz, Self-host guide): it costs nothing and keeps the pages one family (option X).

### Auth card (screens 2 to 4)

One component, `admin-card`, for every card before the panel: a glass card (`.glass`, `--radius-card`), `--measure-form` wide, centred, with the brand icon (`.final-icon`, 64px), an `h1`, one paragraph and then the state's controls.

```
1280                                                   375
┌───────────── site header 56 ──────────────┐          ┌──────── header 52 ────────┐
│ [■✓] todz                                 │          │ [■✓] todz                 │
├───────────────────────────────────────────┤          ├───────────────────────────┤
│                          96               │          │            48             │
│              ╭── 28rem glass card ──╮     │          │ ╭─ glass card, 100% -32 ─╮│
│              │  padding 32          │     │          │ │ padding 16             ││
│              │       [icon 64]      │     │          │ │       [icon 64]        ││
│              │   h1  --text-title   │     │          │ │   h1  --text-title     ││
│              │   p   muted          │     │          │ │   p   muted            ││
│              │   … state controls   │     │          │ │   … state controls     ││
│              ╰──────────────────────╯     │          │ ╰────────────────────────╯│
│                  (page height grows,      │          │  (page height grows)      │
│                   card stays top-anchored)│          │                           │
├───────────────────────────────────────────┤          ├───────────────────────────┤
│ footer 72                                 │          │ footer stacked            │
└───────────────────────────────────────────┘          └───────────────────────────┘
```

- Card padding is `--space-4` below 640 and `--space-6` from 640, so the 300px Turnstile widget fits at 375 (343 card - 32 padding = 311).
- The card is top-anchored, never vertically centred: the interaction-only widget appears after the first click and grows the card downward, so nothing under the pointer moves.
- Card background is the page's aurora; the wallpaper stays on the landing (option S).
- Entrance: the card gets `.rise` once (the landing's copy entrance). No stagger.

Dark: only tokens change. `--glass-fill` `rgb(23 26 46 / 0.55)`, `--color-text` `#F2F4FF`, `--color-text-muted` `#A9B0D6`, `--color-link` mint, `--color-focus` mint; the icon, button gradient and mint dot are identical.

## 2. Screen 1: sign-in card at `/admin`

States: idle, submitting, no widget (unconfigured: the post answers 503), widget showing. The 429, 403 and 503 answers are screen 3.

```
1280 / 375 card content (same stack, different padding)
╭───────────────────────────────────╮
│            [■✓] 64                │  brand icon, aria-hidden
│        Sign in to the admin       │  h1 --text-title, 650, centred
│  Enter your address to get a      │  p --text-body, muted, centred
│  sign-in link.                    │
│                                   │  --space-5
│  ╭─────────────────────────────╮  │  input pill: --size-capsule 56 (52 <640),
│  │ you@example.com             │  │  glass, --radius-pill, full card width
│  ╰─────────────────────────────╯  │
│  [        Email me a link       ]  │  .join-button: gradient, full width, gap 8
│  ┌ turnstile slot ─────────────┐  │  .cf-turnstile, centred; 0 tall until
│  │ (interaction-only: empty)   │  │  Cloudflare asks, then 300 × 65
│  └─────────────────────────────┘  │
╰───────────────────────────────────╯
```

- The field and the button are stacked at every width (option F). The landing's one-capsule form needs `.join-capsule` to stay `display:grid` from 640 up; the plan overrides it under `.admin-card`.
- Reuses `.join-input`, `.join-button`, `.cf-turnstile` and the landing's script behaviour: the first submit sets `aria-disabled="true"` and swaps the label to "Sending…" (`data-submitting`), a second submit is ignored, and when the widget has no token yet the submit waits for the Turnstile callback and then posts. The widget's `data-action` is `admin_sign_in`; its callback name differs from the waitlist's so the two page scripts stay distinct.
- No widget, no secret: the card renders without the widget (as the landing does with `usableSiteKeyOf`) and the post answers the 503 card.
- No JavaScript at all: the widget never loads, the form posts without a token and the answer is the 429 card. Acceptable: the only reader is a programmer who owns the page.

| State | Looks | Announces |
|---|---|---|
| Idle | as drawn | label "Email address", button "Email me a link" |
| Focus | 3px `--color-focus` ring, 2px offset, on the input and on the button | the control |
| Invalid | native `required` + `type=email`; `:user-invalid` dashed `--color-text-muted` ring, no red | the browser's message |
| Submitting | `aria-disabled`, saturate 0.7, label "Sending…" | "Sending…" |
| Widget showing | the slot grows to 300 × 65 below the button | the widget's own label |

Dark: tokens only; Turnstile `data-theme="auto"` follows the scheme.

## 3. Screen 2: the answer cards

All four are `admin-card` full-page answers to a POST; each carries its own `<title>` so a screen reader announces the new page, and the element holding the answer carries `data-answer`, which the page script focuses on load with `preventScroll` (the landing's notice-focus pattern) so the answer is read once.

### 3a. Check your inbox (200, same for every address)

```
1280 / 375
╭───────────────────────────────────╮
│            [■✓] 64                │
│         Check your inbox          │  h1, data-answer, tabindex=-1
│  If that address can sign in, a   │  p muted
│  link is on its way. It works     │
│  once, for 15 minutes, in this    │
│  browser.                         │
│          Back to sign in          │  text link to /admin, --color-link
╰───────────────────────────────────╯
```

No form, no widget. "Back to sign in" is a plain link (44px tap height, `.back-to-top a` look). It never says whether a mail left (spec: same card for every address).

### 3b. 429 "Couldn't send a link right now" (limit, bad body, refused challenge)

The sign-in card again, with the landing's notice row in the slot under the controls and the form usable for a retry:

```
╭───────────────────────────────────╮
│            [■✓] 64                │
│       Sign in to the admin        │
│  Enter your address to get a      │
│  sign-in link.                    │
│  ╭─────────────────────────────╮  │  empty (the address is never echoed back)
│  │ you@example.com             │  │
│  ╰─────────────────────────────╯  │
│  [        Email me a link       ]  │
│  ● Couldn't send a link right     │  .join-notice: mint dot + --color-text 500,
│    now. Try again in a minute.    │  role="status", data-answer, tabindex=-1
╰───────────────────────────────────╯
```

`Retry-After: 60` is a header only; no countdown (no script needed).

### 3c. 503 "The admin is closed right now."

```
╭───────────────────────────────────╮
│            [■✓] 64                │
│  The admin is closed right now.   │  h1, data-answer
╰───────────────────────────────────╯
```

No form, no link, no body: nothing to retry from this page, and nothing about why (a missing key, `ADMIN_EMAIL` unset or D1 down look alike). The same card answers a panel load when D1 throws.

### 3d. 403 cross-origin

```
╭───────────────────────────────────╮
│            [■✓] 64                │
│         Request refused           │  h1, data-answer
│  That request didn't come from    │  p muted
│  this site.                       │
│          Back to sign in          │  link to /admin
╰───────────────────────────────────╯
```

The spec gives no string for this card; the two strings here are new and listed as such in section 8.

Dark: tokens only. Mint dot and notice text keep the landing's contrast.

## 4. Screen 3: the link page `/admin/sign-in`

One card, three states, one live region. The server always sends the same HTML (the token is in the fragment and never reaches the server); the page script reads the fragment, removes it from the address bar with `history.replaceState` before the request, posts `/admin/sessions`, and then either replaces the location with `/admin` (201) or shows the failed state (any other answer, or a thrown request).

```
1280 / 375 (shared card)
Working                                   Failed
╭───────────────────────────────────╮    ╭───────────────────────────────────╮
│            [■✓] 64                │    │            [■✓] 64                │
│  ● Signing you in…  (h1)          │    │    This link can't be used. (h1)  │
│                                   │    │  Ask for a new one from this      │
│                                   │    │  browser.                         │
│                                   │    │         Get a new link            │  link to /admin
╰───────────────────────────────────╯    ╰───────────────────────────────────╯

No script (server markup, nothing hidden by CSS)
╭───────────────────────────────────╮
│            [■✓] 64                │
│     Finish signing in             │  h1
│  This page needs JavaScript to    │  <noscript> paragraph
│  finish signing you in. Turn it   │
│  on, then open the link again.    │
╰───────────────────────────────────╯
```

- Markup: the card holds `<div role="status" aria-live="polite" data-answer>` with the page's `h1` (the state title: "Signing you in…", then "This link can't be used.") and one `<p>` (empty while working, the failed body after), plus the "Get a new link" anchor, `hidden` until the failed state. The server sends the region `hidden`, and the script reveals it with the working title; a `<noscript>` block with its own `h1` and paragraph is the only thing a script-less browser shows, so nothing flashes either way.
- Failed state: the script swaps the `h1` text, fills the `<p>`, reveals the link and does not move focus; the polite live region announces the change once. The link is the first control after the header, so Tab reaches it at once.
- The working dot is the landing's `.notice-dot`; under no-preference it pulses opacity 1 → 0.4 at `--duration-arrive`, still under reduce.
- The page `<title>` is "Signing in · todz admin" and the script does not change it.
- Dark: tokens only.

## 5. Screen 4: the panel at `/admin`

States: populated, populated with more than 200 rows, empty, closed (the 503 card of 3c). There is no loading state: the page is one server response, and no overloaded state beyond the cap note.

### 1280 (populated, more than 200)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ [■✓] todz                                                              [ Sign out ] │ shell header 56, glass;
├─────────────────────────────────────────────────────────────────────────────────────┤ Sign out = POST form, .nav-link look
│                                       64                                            │
│              ┌─────────────────────── 46rem (--measure-hero) ───────────────────┐   │
│              │ Waitlist                                      ( Download CSV )   │   │ h1 --text-section; action: glass pill 44
│              │                                                                  │   │
│              │ ╭ On the list ───╮ ╭ Last 24 hours ─╮ ╭ Failed confirmations ╮    │   │ 3 glass tiles, gap 16,
│              │ │ 1,284          │ │ 37             │ │ 2                    │    │   │ number --text-section 700
│              │ ╰────────────────╯ ╰────────────────╯ ╰──────────────────────╯    │   │ tabular-nums; label --text-small muted
│              │                                                                  │   │
│              │ ╭ glass card r24 ────────────────────────────────────────────╮   │   │ --space-6 above
│              │ │ Address                        Joined             Confirmation│  │   │ th: --text-small 600 muted
│              │ │────────────────────────────────────────────────────────────│  │   │ hairline between rows
│              │ │ ana@example.com        2026-11-25 14:03 UTC       ● Sent      │  │   │ row min 48, body text
│              │ │ bo@example.org         2026-11-25 13:41 UTC       ○ Failed    │  │   │
│              │ │ … up to 200 rows                                              │  │   │
│              │ │────────────────────────────────────────────────────────────│  │   │
│              │ │ Showing the newest 200 of 1,284. The CSV has all.            │  │   │ table-note, --text-small muted
│              │ ╰────────────────────────────────────────────────────────────╯   │   │
│              └──────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ footer                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Column widths: Address `1fr` (wraps with `overflow-wrap: anywhere`, a 254-character address never widens the page), Joined `max-content`, Confirmation `max-content`, `--space-5` between and card padding `--space-5`.

### 375 (recommended: stacked rows, option T-B)

```
┌───────────────────────────────────┐
│ [■✓] todz               [Sign out]│ header 52
├───────────────────────────────────┤
│ Waitlist                          │ h1
│ ( Download CSV )                  │ glass pill, content width, left
│ ╭───────────────────────────────╮ │
│ │ On the list              1,284│ │ stat tile as a row: label left,
│ ╰───────────────────────────────╯ │ number right, height 56, gap 8
│ ╭───────────────────────────────╮ │
│ │ Last 24 hours               37│ │
│ ╰───────────────────────────────╯ │
│ ╭───────────────────────────────╮ │
│ │ Failed confirmations         2│ │
│ ╰───────────────────────────────╯ │
│ ╭ glass card ───────────────────╮ │
│ │ ana@example.com               │ │ row = grid 1fr auto: address spans,
│ │ 2026-11-25 14:03 UTC  ● Sent  │ │ then joined left, badge right
│ │───────────────────────────────│ │
│ │ a-very-long-address-that-wraps│ │
│ │ -anywhere@example.org         │ │
│ │ 2026-11-25 13:41 UTC ○ Failed │ │
│ │───────────────────────────────│ │
│ │ Showing the newest 200 of     │ │
│ │ 1,284. The CSV has all.       │ │
│ ╰───────────────────────────────╯ │
└───────────────────────────────────┘
```

### Empty (1280 and 375 share it)

```
│ Waitlist                                         ( Download CSV )    │
│ ╭ On the list 0 ╮ ╭ Last 24 hours 0 ╮ ╭ Failed confirmations 0 ╮      │ tiles still shown, zeros
│ ╭ glass card ────────────────────────────────────────────────────╮   │
│ │             No one on the list yet.                            │   │ --text-title 650, centred
│ │   Addresses show up here as soon as someone joins.             │   │ muted, centred
│ ╰────────────────────────────────────────────────────────────────╯   │
```

No table markup renders when there are no rows (an empty `tbody` is noise for a screen reader). Download CSV stays enabled: the file is the valid header-only CSV.

### Table, badge and tiles

- **Table.** `<table>` in a glass card; `<caption class="visually-hidden">`, `<th scope="col">` per column, the address cell a `<th scope="row">` (the address identifies the row), the joined cell `<td><time datetime="2026-11-25T14:03:00Z">2026-11-25 14:03 UTC</time></td>`, the confirmation cell `<td>` with the badge. Joined is minute-precision UTC in a locale-free `YYYY-MM-DD HH:mm UTC` form: no script, no timezone guess (option J).
- **Stacked at 375.** Below 640 the `table`, `tbody`, `tr`, `th`, `td` are `display: block`/`grid`, the header row stays in the DOM as `visually-hidden`, and explicit `role="table"`, `rowgroup`, `row`, `columnheader`, `rowheader`, `cell` attributes sit on the elements, because WebKit drops table semantics from a re-displayed table. The row grid is `1fr auto`: address in both columns, joined in the first, badge in the second. No per-cell pseudo labels: "Sent" and "Failed" say what they are and a date is a date, so a screen reader never hears a label twice.
- **Badge.** A pill (`--radius-pill`, `--text-small`, 600). Sent: a filled `--color-mint` dot, label `--color-text-muted` on no fill. Failed: a hollow dot (2px `--color-text` ring), label `--color-text`, `--color-chip` fill and a 1px dashed `--color-text-muted` border. Shape, fill and word differ, so the state never rides on colour; forced colours keep the border. No red (option B). The dot is `aria-hidden`; the text is the announcement.
- **Stat tile.** `<dl>`: each tile is `<div><dt>label</dt><dd>number</dd></div>`, `.glass`, `--radius-card`, padding `--space-5` (`--space-4` below 640). Numbers are grouped server-side with `en-US` (`1,284`). A non-zero Failed count is not coloured; the rows carry the signal.
- **Actions.** Download CSV is `<a href="/admin/export.csv" download>`: glass pill 44px (`--size-tap`), `--color-text` 600, hover `--color-hairline` fill, the nav-link motion. It is secondary on purpose: the only gradient button in the admin is "Email me a link" (option C). Sign out is a `<form method="post" action="/admin/sign-out">` with a `<button>` that looks like `.nav-link`.

Dark: tokens only. The glass card, hairlines, chip (`rgb(47 91 255 / 0.16)`) and text colours switch with `:root`; the badge dot stays mint (decorative, never the carrier).

## 6. Screen 5: the admin mail

The existing layout, unchanged: `EmailLayout` (dark `#0E1020` header with the mint rule and the 240 × 80 lockup, white `#FFFFFF` card, `#E1E5F2` rule, 13px muted footer), on `EmailTemplateName.AdminSignIn` in `apps/api/scripts/emails/admin-sign-in-template.ts`, copy in `admin-sign-in-email-copy.ts`, the same shape as `sign-in-template.ts`.

```
600 (container 560)                                  375 (same stack, page padding 12)
┌ page #F2F4FA ──────────────────────────────┐       ┌ page ─────────────────────┐
│ ┌ header #0E1020 · 3px mint rule ────────┐ │       │ ┌ header ───────────────┐ │
│ │            [ todz lockup ]             │ │       │ │     [ lockup ]        │ │
│ ├────────────────────────────────────────┤ │       │ ├───────────────────────┤ │
│ │ Sign in to the admin       h1 26/34    │ │       │ │ Sign in to the admin  │ │
│ │ Use the button to sign in to the todz  │ │       │ │ Use the button to … ← │ │
│ │ admin.                       16/24     │ │       │ │                       │ │
│ │                                        │ │       │ │     ( Sign in )       │ │
│ │            ( Sign in )  pill, gradient │ │       │ │ Opens in the wrong    │ │
│ │ Opens in the wrong browser? Paste this │ │       │ │ browser? Paste this   │ │
│ │ link into the one where you asked:     │ │       │ │ link into …           │ │
│ │ https://todz.app/admin/sign-in#token=… │ │       │ │ https://todz.app/…    │ │
│ │ ────────────────────────────────────── │ │       │ │ ───────────────────── │ │
│ │ This link works once, for 15 minutes,  │ │       │ │ This link works once, │ │
│ │ in the browser where you asked for it. │ │       │ │ for 15 minutes, …     │ │
│ └────────────────────────────────────────┘ │       │ └───────────────────────┘ │
└────────────────────────────────────────────┘       └───────────────────────────┘
```

- Heading, text, muted line, link, rule and button use `HEADING_STYLE`, `PARAGRAPH_STYLE`, `MUTED_STYLE`, `LINK_STYLE`, `ACTION_STYLE` and `BUTTON_STYLE` as `sign-in-template.ts` does; the footnote goes in the layout's `footer` prop (below the rule).
- The paste-the-link line is kept (option M): the link only works in the browser that asked, and a mail client opens its own default browser. Pasting is how the owner reaches the right one.
- Dark mail: `DARK_MODE_CSS` already swaps page, card, text, muted, rule, link (mint) and button text. No change.
- Known and out of scope: white on `#4C6BFF` (the mail button's fallback fill, shared by every mail) is 4.3:1. The landing design records the same number for that start colour. The admin mail keeps the shared style so the four mails stay one family; moving the mail button to `#2F5BFF` is a separate change to all of them.

## 7. Components

All in `apps/api/src/site/` unless noted, each named by the class the stylesheet gives it. New CSS is rules over existing tokens inside the one hashed `SITE_STYLE`; there are no inline `style=""` attributes (CSP).

| Component | Path | Reuses / adds |
|---|---|---|
| `site-header`, `site-footer`, `skip-link`, `brand` | `site-shell.ts` | reused; header nav becomes a parameter (nothing, or the Sign out form) |
| `admin-card` | `admin-page.ts` (new) | `.glass`, `.final-icon`, `.rise`; adds `.admin-card` (width `--measure-form`, padding, top anchoring), `.admin-title`, `.admin-body` |
| `join-input`, `join-button`, `cf-turnstile`, `join-notice`, `notice-dot` | `site-style.ts` | reused as is; `.admin-card .join-capsule` keeps the stacked grid at ≥ 640 |
| `nav-button` | `site-style.ts` | `.nav-link` look on a `<button>` (font inherit, no border, no background, pointer) |
| `admin-link` | `site-style.ts` | text link under a card ("Back to sign in", "Get a new link"): `.back-to-top a` look |
| `link-status` | `admin-link-page.ts` (new) | the live region of screen 3 and its script |
| `stat-tile` | `site-style.ts` | `.glass`, `--radius-card`, `<dl>` markup |
| `admin-action` | `site-style.ts` | glass pill 44: Download CSV |
| `admin-table`, `badge`, `table-note` | `site-style.ts`, `admin-panel-page.ts` (new) | `.glass` card, hairlines, `.notice-dot`-sized dots |
| mail | `apps/api/scripts/emails/admin-sign-in-template.ts`, `admin-sign-in-email-copy.ts` (new) | `EmailLayout`, `email-style.ts` constants |

Copy lives in `apps/api/src/site/admin-copy.ts` (`ADMIN_COPY`); email address label and placeholder come from `LANDING_COPY.join.emailLabel` and `.emailPlaceholder` so they cannot drift.

## 8. Copy

### `admin-copy.ts` (`ADMIN_COPY`)

| id | Text |
|---|---|
| `meta.description` | The todz waitlist, for the owner. |
| `meta.signInTitle` | Sign in · todz admin |
| `meta.inboxTitle` | Check your inbox · todz admin |
| `meta.refusedTitle` | Request refused · todz admin |
| `meta.closedTitle` | Admin closed · todz admin |
| `meta.linkTitle` | Signing in · todz admin |
| `meta.panelTitle` | Waitlist · todz admin |
| `shell.navLabel` | Admin |
| `signIn.title` | Sign in to the admin |
| `signIn.lead` | Enter your address to get a sign-in link. |
| `signIn.submit` | Email me a link |
| `signIn.submitting` | Sending… |
| `inbox.title` | Check your inbox |
| `inbox.body` | If that address can sign in, a link is on its way. It works once, for 15 minutes, in this browser. |
| `inbox.back` | Back to sign in |
| `refusal.tooMany` | Couldn't send a link right now. Try again in a minute. |
| `refusal.closed` | The admin is closed right now. |
| `refusal.crossOriginTitle` ★ new | Request refused |
| `refusal.crossOriginBody` ★ new | That request didn't come from this site. |
| `link.working` | Signing you in… |
| `link.failedTitle` | This link can't be used. |
| `link.failedBody` | Ask for a new one from this browser. |
| `link.failedAction` | Get a new link |
| `link.noScriptTitle` | Finish signing in |
| `link.noScript` | This page needs JavaScript to finish signing you in. Turn it on, then open the link again. |
| `panel.title` | Waitlist |
| `panel.signOut` | Sign out |
| `panel.download` | Download CSV |
| `panel.summaryHeading` | Summary |
| `panel.tableHeading` | Addresses |
| `stats.total` | On the list |
| `stats.recent` | Last 24 hours |
| `stats.failed` | Failed confirmations |
| `table.caption` | Waitlist, newest first |
| `table.address` | Address |
| `table.joined` | Joined |
| `table.confirmation` | Confirmation |
| `table.sent` | Sent |
| `table.failed` | Failed |
| `table.timeZone` | UTC |
| `table.capNote({ shown, total })` | Showing the newest {shown} of {total}. The CSV has all. |
| `empty.title` | No one on the list yet. |
| `empty.body` | Addresses show up here as soon as someone joins. |

`link.failedTitle` + `link.failedBody` read as the spec's one sentence pair, "This link can't be used. Ask for a new one from this browser." The spec fixes `refusal.tooMany`, `refusal.closed`, the inbox card's role and the failed link text; the rest is this design's proposal.

### `admin-sign-in-email-copy.ts` (`ADMIN_SIGN_IN_EMAIL_COPY`)

| id | Text |
|---|---|
| `subject` | Sign in to the todz admin |
| `preview` | Your link to the todz admin. It works once. |
| `heading` | Sign in to the admin |
| `intro` | Use the button to sign in to the todz admin. |
| `action` | Sign in |
| `fallback` | Opens in the wrong browser? Paste this link into the one where you asked: |
| `footer` | This link works once, for 15 minutes, in the browser where you asked for it. |

## 9. Tokens

None added. Every value below exists in `SITE_STYLE` today; the admin names them and nothing else.

| Use | Token |
|---|---|
| page, card ground | `--color-page`, `--gradient-aurora`, `--glass-fill`, `--glass-sheen`, `--glass-blur`, `--glass-edge`, `--shadow-glass` (cards), `--shadow-card` (tiles, pills) |
| text | `--color-text`, `--color-text-muted`, `--color-link`, `--color-hairline`, `--color-chip` |
| action | `--gradient-action`, `--color-on-action`, `--shadow-action` (only "Email me a link") |
| focus | `--color-focus`, 3px outline, 2px offset |
| status | `--color-mint` (Sent dot, notice dot), `--color-accent` unused on admin text |
| radius | `--radius-card` 24 (cards, tiles, table card), `--radius-pill` (field, buttons, badge, Download CSV) |
| space | `--space-1` to `--space-9`: card padding `--space-6` (`--space-4` <640), tile gap `--space-4`, section gap `--space-6`, page top `--space-9` (`--space-7` <640) |
| type | `--text-title` (card h1, empty title), `--text-section` (panel h1, tile numbers), `--text-body`, `--text-small` (labels, th, badge, notes), `--text-eyebrow` unused; `--font-sans`, tabular-nums for numbers and dates |
| measure | `--measure-form` (cards), `--measure-hero` (panel, 46rem) |
| size | `--size-tap` 44, `--size-capsule` 56/52, `--size-header` 56/52 |
| motion | `--duration-quick`, `--duration-base`, `--duration-arrive`, `--ease-out` |

The breakpoint is the landing's `NARROW_BREAKPOINT` (40rem). Nothing needs `WIDE_BREAKPOINT`.

## 10. Interaction and accessibility

**Focus order.**

| Screen | Order |
|---|---|
| Sign-in | skip link, brand, email, Email me a link, (widget, once shown), footer self-host link |
| Check your inbox, 403 | skip link, brand, Back to sign in, footer link |
| 429 | skip link, brand, email, Email me a link, (widget), footer link; focus lands on the notice on load, then Tab goes to the brand |
| 503 | skip link, brand, footer link |
| Link page | skip link, brand, (Get a new link once the failed state shows), footer link |
| Panel | skip link, brand, Sign out, Download CSV, footer link |

The email input is not autofocused (no keyboard jump on mobile, no surprise scroll). `Enter` in the field submits. Every control is 44px or taller.

**Landmarks and names.** `header` with `nav aria-label="Admin"` holding Sign out (panel only), `main#content`, `footer`. One `h1` per page: the card title, or "Waitlist". The panel adds two visually hidden `h2`s, "Summary" over the tiles and "Addresses" over the table. The field has a visually hidden `label` "Email address", `autocomplete="email"`, `inputmode="email"`, `required`. The icon, dots and glyphs are `aria-hidden`. Sign out is a `button`, Download CSV a link whose name is its text.

**Live regions.** The link page's `div role="status" aria-live="polite"` is the only live region; its text changes once, from working to failed. The 429 notice is `role="status"` and is also focused on load, as the landing's notice is, so it is read once. A full-page answer needs no live region: its `<title>` and focused heading announce it.

**Table semantics.** `caption`, column headers with `scope="col"`, row headers on the address, `time` with `datetime`. At 375 the explicit roles of section 5 keep the table a table. There is no horizontal scroll region, so no `tabindex` is needed.

**Contrast (WCAG AA), measured on the opaque fallback as in the landing design.** Pairs shared with the landing are quoted from it; the three new pairs are computed from the token values and the tester confirms them with computed styles in the walk.

| Pair | Light | Dark |
|---|---|---|
| text on page / surface | `#161A33` on `#F2F4FA` 15.6:1 | `#F2F4FF` on `#070812` 18.2:1 |
| muted on page, th, labels, note | `#5B6285` on `#F2F4FA` 5.4:1 | `#A9B0D6` on `#070812` 9.4:1 |
| muted on glass | 5.5:1 | 8.1:1 |
| link (Back to sign in, Get a new link) | `#2F5BFF` 4.7:1 | `#8CF7D0` on `#070812` 15.5:1 |
| button label | `#FFFFFF` on `#2F5BFF` 5.2:1 | same |
| focus ring vs page | 4.7:1 | 15.5:1 |
| Failed badge text `--color-text` on `--color-chip` over white | about 15.2:1 | about 13.8:1 |
| Failed badge dashed border `--color-text-muted` (non-text, 3:1) on the same fill | about 5.3:1 | about 7.0:1 |
| Sent badge text muted on glass | 5.5:1 | 8.1:1 |
| mint dot (Sent) | decorative: the word "Sent" carries the state | same |

**Forced colours.** The landing's rule extends to the admin: `.glass`, the tiles and the table card lose fills and shadows and keep a 1px `CanvasText` border; the button becomes `ButtonFace`/`ButtonText`; the badge keeps its border (dashed for Failed); the dots become `CanvasText`.

**Transparency.** `prefers-reduced-transparency` and the no-backdrop-filter fallback already swap `.glass` for `--color-surface`; new glass rules join those selector lists.

## 11. Motion and reduced motion

- Cards and the panel's content rise once on load with the landing's `.rise` (640ms, 16px, `--ease-out`). Nothing is staggered and nothing scroll-reveals.
- The 429 notice fades in with the landing's `.join-notice` animation.
- The link page's working dot pulses opacity 1 → 0.4; the panel has no count-up or skeleton.
- Hover and press: `--duration-quick` colour and `scale(0.98)` as `.join-button`.
- Reduced motion: every animation is inside `@media (prefers-reduced-motion: no-preference)` and animates from a hidden state, so under reduce, or without CSS animation, every card is fully visible and still; colour transitions stay at `--duration-quick`, as the landing's reduce block already forces.

## 12. Options (the loop picks; recommendation marked ✅)

**S. Where the sign-in card sits**

| | Option | Trade-off |
|---|---|---|
| ✅ S-A | On the page's aurora, no wallpaper | quiet and small, the owner's wish; the glass has little to refract, so the card reads as a soft white panel, the same as the benefit cards |
| S-B | Inside a wallpaper stage like the landing's final call | prettiest, the most "Liquid Glass"; loud for a page one person opens, and a 28rem card in a 72rem stage wastes the screen |

**P. Where the panel's header row lives**

| | Option | Trade-off |
|---|---|---|
| ✅ P-A | The shell header carries brand left and Sign out right; `h1` "Waitlist" and Download CSV open the content | one header, the shell reused; "todz glyph, Waitlist, Sign out" are all on screen in that order, the title one band below |
| P-B | A second row inside `main` with glyph, "Waitlist", Sign out | matches the spec's sentence literally; two stacked headers (the sticky shell one and this) at 52px each eat a seventh of a 375 screen |

**F. The field layout in the card**

| | Option | Trade-off |
|---|---|---|
| ✅ F-A | Field and button stacked at every width | a 28rem card cannot hold a field and "Email me a link" in one capsule without a 160px field; the widget sits cleanly beneath |
| F-B | The landing's one capsule from 640 | identical to the waitlist; the placeholder truncates |

**T. The table at 375**

| | Option | Trade-off |
|---|---|---|
| T-A | Horizontal scroll in a focusable region | one markup, native semantics; the badge sits off-screen at first and the owner scrolls sideways to see what failed |
| ✅ T-B | Stacked rows: address, then joined and badge on one line | the whole row reads at a glance, long addresses wrap; needs explicit ARIA roles to keep table semantics in WebKit and a media rule |
| T-C | Hide the Joined column below 640 | simplest; loses the date the owner may want to see |

**B. The Failed badge**

| | Option | Trade-off |
|---|---|---|
| ✅ B-A | Shape, fill and word only (hollow dot, chip fill, dashed border) | no new colour, passes without colour, matches the landing's "no red"; less alarming than red |
| B-B | A red ★ for Failed | immediate; a new token pair to contrast-tune in both schemes, and the landing never uses red |

**C. Download CSV**

| | Option | Trade-off |
|---|---|---|
| ✅ C-A | Secondary: glass pill | the gradient stays the single primary action; quiet |
| C-B | Primary gradient button | the most visible; two primaries on the admin and the sign-in card, and exporting is not the page's one job |

**J. Joined format**

| | Option | Trade-off |
|---|---|---|
| ✅ J-A | `2026-11-25 14:03 UTC`, server-rendered | no script, locale-free, matches the CSV's UTC; the owner converts in his head |
| J-B | Local time rewritten by script | friendlier; a second script and hash, and the page shows UTC for a moment |

**M. The paste-the-link line in the mail**

| | Option | Trade-off |
|---|---|---|
| ✅ M-A | Include it, as `sign-in-template.ts` does | the link is bound to the browser that asked, and a mail client opens its own default; pasting fixes that; adds one muted paragraph and the raw link |
| M-B | The spec's bare mail: heading, sentence, button, footnote | shortest; a click that lands in the wrong browser dead-ends at "This link can't be used" |

**X. The footer on admin pages**

| | Option | Trade-off |
|---|---|---|
| ✅ X-A | Keep it | the shell untouched, one family |
| X-B | Drop it | quieter; a shell parameter for no reader benefit |

## 13. Notes for the plan

- The inline page scripts are two, each fixed source with its own hash: the sign-in card's (the landing's submit guard and token wait, with an admin callback name and the answer focus) and the link page's (read the fragment, `replaceState`, post, redirect or fail). `siteContentSecurityPolicy` already takes one script and an optional widget origin.
- No `style=""` anywhere; every position and size is a class in `SITE_STYLE`.
- `Cache-Control: no-store` and `X-Robots-Tag: noindex` are headers on every admin page; `<meta name="robots" content="noindex">` is not needed.
- The tester shoots every screen at 1280 and 375, light and dark, with and without `prefers-reduced-motion`, with the widget absent (the dev key set empty) and with the console sender's link, and checks the 375 table stack against a 254-character address.
- Media for the PR: the recorder walks sign in, the inbox card, the link in a second browser (failed), the panel with rows, empty, and the 200-row note.

## Owner decisions

The owner is away and the build loop decides (PROMPT.md). These are the loop's picks, recorded for him to overturn:

- S-A, P-A, F-A, T-B, B-A, C-A, J-A, M-A and X-A: the recommended options, as written above.
- The three new strings `refusal.crossOriginTitle`, `refusal.crossOriginBody` and the link page's `link.noScriptTitle` are the loop's wording; the spec gave none.
- The mail button's 4.3:1 fill is left as the other mails have it; the follow-up is for all of them at once.
