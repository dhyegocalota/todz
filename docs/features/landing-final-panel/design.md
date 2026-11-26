# Design: the final panel of todz.app (`#ways`, "Get todz on your Mac.")

Read: `apps/api/src/site/landing-page.ts` (`finalCallHtml`, `waysHtml`, `signatureHtml`, `downloadHtml`, `howItWorksHtml`), `landing-copy.ts`, `site-style.ts` (`SITE_STYLE`), `star-pill.ts`, `star-count-script.ts`, `repository-stars.ts`, `site-glyphs.ts`, `site-shell.ts` (footer pill), `apps/api/test/free-hero.test.ts` (the pins this redesign moves), `apps/docs/self-host.mdx` (step 4), `apps/api/package.json` (`server:deploy`), `docs/features/open-source-surfaces/design.md`, `docs/features/landing/design.md`.

**Before screenshots: not taken.** This designer session had no Playwright MCP and no shell, so the live panel at https://todz.app could not be opened. The "today" description below comes from the source. The recorder must take these before the developer starts, at `.pr-media/landing-final-panel/design/`: `before-1280-light.png`, `before-1280-dark.png`, `before-390-light.png`, `before-390-dark.png`. Each one is a full-element screenshot of `#ways` plus the footer, with dark set through `emulateMedia({ colorScheme: 'dark' })`.

## 1. What is on screen today, and why it reads flat

```
1280                                                      390
┌ .final-call: --gradient-wallpaper, r28, pad 64/24 ───────┐  ┌ wallpaper, pad 64/16 ────┐
│                       [icon 64]                          │  │        [icon 64]         │
│                  Get todz on your Mac.                   │  │  Get todz on your Mac.   │
│ ┌ glass, 1fr ────────────────┐ ┌ glass, 1fr ───────────┐ │  │ ┌ glass ───────────────┐ │
│ │ todz cloud  (Free)         │ │ Self-host (Open src)  │ │  │ │ todz cloud (Free)    │ │
│ │ Sign in with your email.   │ │ Run the server on …   │ │  │ │ Sign in with your …  │ │
│ │ Synced across …            │ │                       │ │  │ │ [ Download for Mac ] │ │
│ │            (empty glass)   │ │       (empty glass)   │ │  │ └──────────────────────┘ │
│ │ [ Download for Mac ]       │ │ ( Server setup guide )│ │  │ ┌ glass ───────────────┐ │
│ └────────────────────────────┘ └───────────────────────┘ │  │ │ Self-host (Open src) │ │
│   The app is the same either way, and updates itself.    │  │ │ ( Server setup guide)│ │
│                          ───                             │  │ └──────────────────────┘ │
│  Built by a developer, for … — Dhyego Calota             │  │ The app is the same …    │
└──────────────────────────────────────────────────────────┘  │ ─── Built … Dhyego Calota│
                                                              └──────────────────────────┘
```

- The two cards weigh the same: same glass, same shadow, same `1fr`. Nothing says "this is the one most people want".
- Each card is 540 px wide at 1280 and holds one sentence, so `.way-body{flex:1}` leaves a band of empty glass above each button.
- `.way-cta-secondary` is a chip-coloured capsule. Next to the gradient button it reads as a disabled button, not as a path.
- The panel opens with a 64 px icon and 64 px of padding before any choice, then ends with a 1 px rule and a muted line. The page ends on small print.
- The honest "Not notarized by Apple yet" line lives only in the hero. A visitor who downloads from the panel never sees it.
- The open-source proof (stars) is in the hero and the footer, not in the card that says "Open source".
- Contrast risk: `.ways-note` and `.signature` are `--color-text-muted` (#5B6285) set straight on the light wallpaper. Near the `#6AA6FF` radial (10% 115% of the panel) that estimates at about 2.4:1 to 4:1, under AA. The tester must measure it, and every option below fixes it.

## 2. Options

All three keep: section `id="ways"` and its `scroll-margin-top`, h2 `final.title`, `/download` with the `download` attribute, `DOCS_INSTALL_URL` with the note, `DOCS_SELF_HOST_URL`, `starPillHtml(stars)` unchanged, and `.reveal` on the panel. All three remove the panel's top icon and move a 40 px copy of it into the cloud card. That saves 88 px of empty height and puts the brand on the product it names.

### Option A: primary card and terminal card (recommended)

```
1280 (content 1088 px; grid 7fr 5fr, gap 24)
┌ .final-call wallpaper, pad 64/32 ─────────────────────────────────────────────┐
│                         Get todz on your Mac.                                 │
│ ┌ .way-card-cloud: glass + mint glow, pad 32 ─┐ ┌ .way-card: glass, pad 24 ──┐ │
│ │ [icon40] todz cloud   (● Free)             │ │ Self-host   (Open source)  │ │
│ │ ✓ Sign in with your email.                 │ │ Run the server on your own │ │
│ │ ✓ Synced across your Macs and agents.      │ │ Cloudflare account. Same   │ │
│ │ ✓ Nothing to run.                          │ │ app: switch the server in  │ │
│ │ [========= Download for Mac =========]     │ │ Settings.                  │ │
│ │ Not notarized by Apple yet: the first      │ │ ┌ .way-terminal ─────────┐ │ │
│ │ time, open it from System Settings ›       │ │ │ ● ● ●                  │ │ │
│ │ Privacy & Security. Install steps          │ │ │ $ pnpm --filter        │ │ │
│ │                                            │ │ │   @todz/api server:dep…│ │ │
│ │                                            │ │ │ todz server ready: htt…│ │ │
│ │                                            │ │ │ → paste it in todz ›   │ │ │
│ │                                            │ │ └────────────────────────┘ │ │
│ │                                            │ │ Server setup guide →       │ │
│ │                                            │ │ [GH Star on GitHub ★ 12]   │ │
│ └────────────────────────────────────────────┘ └────────────────────────────┘ │
│              The app is the same either way, and updates itself.              │
│            ╭ .signature glass note, rotate -1deg, max 28rem ─────╮            │
│            │ Built by a developer, for developers and AI         │            │
│            │ tinkerers.                                          │            │
│            │                              — Dhyego Calota        │            │
│            │                                ~~~~~~~~~~~ (ink)    │            │
│            ╰─────────────────────────────────────────────────────╯            │
└───────────────────────────────────────────────────────────────────────────────┘

390 (panel content 326 px; cards stacked, gap 16; card pad 16 → 294 px inside)
┌ wallpaper, pad 48/16 ──────────┐
│     Get todz on your Mac.      │
│ ┌ cloud: glass + mint glow ──┐ │
│ │ [icon40] todz cloud (●Free)│ │
│ │ ✓ Sign in with your email. │ │
│ │ ✓ Synced across your Macs  │ │
│ │   and agents.              │ │
│ │ ✓ Nothing to run.          │ │
│ │ [=== Download for Mac ===] │ │
│ │ Not notarized by Apple yet:│ │
│ │ the first time, open it …  │ │
│ │ Install steps              │ │
│ └────────────────────────────┘ │
│ ┌ self-host: glass ──────────┐ │
│ │ Self-host  (Open source)   │ │
│ │ Run the server on your own │ │
│ │ Cloudflare account. …      │ │
│ │ ┌ terminal ──────────────┐ │ │
│ │ │ $ pnpm --filter        │ │ │
│ │ │   @todz/api            │ │ │
│ │ │   server:deploy        │ │ │
│ │ │ todz server ready:     │ │ │
│ │ │   https://api.example… │ │ │
│ │ │ → paste it in todz ›   │ │ │
│ │ │   Settings › Server    │ │ │
│ │ └────────────────────────┘ │ │
│ │ Server setup guide →       │ │
│ │ [GH Star on GitHub ★ 12]   │ │
│ └────────────────────────────┘ │
│ The app is the same either     │
│ way, and updates itself.       │
│ ╭ note, -1deg ───────────────╮ │
│ │ Built by a developer, for  │ │
│ │ developers and AI          │ │
│ │ tinkerers.                 │ │
│ │          — Dhyego Calota   │ │
│ │            ~~~~~~~~~~~     │ │
│ ╰────────────────────────────╯ │
└────────────────────────────────┘
```

- **Hierarchy.** The cloud card is wider (7fr), has more padding, sits on `--shadow-glass` (the panel-level shadow) and carries a static mint glow. The self-host card keeps `--shadow-card`. You can tell which is primary from three metres away.
- **No empty glass.** The cloud body becomes three ✓ points (the same three sentences, split). The self-host card gains the terminal. The two columns end within roughly 30 px of each other at 1280, and the cloud CTA keeps `margin-top:auto`, so the buttons line up at the bottom when the heights differ.
- **The generic secondary button goes.** Self-host leads with a real command and a text link with an arrow. The star pill sits beside it as the open-source proof.
- **The notarization line is now beside the Download it qualifies**, in both the hero and the panel.
- **Two columns from `WIDE_BREAKPOINT` (64rem), not from `NARROW_BREAKPOINT`.** At 640 to 1023 px a 5fr column is too narrow for the terminal, so the cards stack there, as they do at 390.
- **Trade-offs.** It adds one terminal block (reusing `.terminal-*`) and one SVG swash. The command is a single deploy step and not the whole setup. The figure's label says "the deploy step", and the guide link sits directly under it.

### Option B: one hero card and a slim terminal strip

```
1280
┌ wallpaper ────────────────────────────────────────────────────────────────┐
│                         Get todz on your Mac.                             │
│ ┌ cloud: glass + mint glow, full width, two columns inside ─────────────┐ │
│ │ [icon40] todz cloud (● Free)          │ [===== Download for Mac =====]│ │
│ │ ✓ Sign in with your email.            │ Not notarized by Apple yet: … │ │
│ │ ✓ Synced across your Macs and agents. │ Install steps                 │ │
│ │ ✓ Nothing to run.                     │                               │ │
│ └───────────────────────────────────────────────────────────────────────┘ │
│ ┌ self-host strip: --color-terminal, r20, one row ──────────────────────┐ │
│ │ Self-host  $ pnpm --filter @todz/api server:deploy   Server setup     │ │
│ │                                          guide →   [GH Star ★ 12]     │ │
│ └───────────────────────────────────────────────────────────────────────┘ │
│        The app is the same either way, and updates itself.                │
│                 ╭ signature note ╮                                        │
└───────────────────────────────────────────────────────────────────────────┘
390: the cloud card stacks (points, button, note); the strip becomes a dark
block: title, command (wrapped), link, pill.
```

- Trade-offs: the strongest "cloud is the answer" read, and the shortest panel at 1280. But the self-host body ("Same app: switch the server in Settings", the promise that makes self-host credible) has no room in a one-row strip and would be cut. The glass star pill on a dark strip looks pasted on in the light scheme, and links on `--color-terminal` need their own colours. At 390 it ends up as tall as A.

### Option C: one split slab

```
1280
┌ wallpaper ────────────────────────────────────────────────────────────────┐
│                         Get todz on your Mac.                             │
│ ┌ one glass slab, r24 ──────────────────────┬ --color-terminal half ─────┐ │
│ │ [icon40] todz cloud (● Free)              │ Self-host (Open source)    │ │
│ │ ✓ … ✓ … ✓ …                               │ $ pnpm --filter @todz/api  │ │
│ │ [====== Download for Mac ======]          │   server:deploy            │ │
│ │ Not notarized … Install steps             │ Server setup guide →       │ │
│ ├───────────────────────────────────────────┴────────────────────────────┤ │
│ │ The app is the same either way …   [GH Star ★ 12]   — Dhyego Calota    │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────┘
390: the dark half drops under the cloud half; the footer row stacks.
```

- Trade-offs: one object, the most "Mac", and the least empty space. But the dark half is the heaviest thing in the panel, so the eye goes to self-host first, the opposite of the brief. The signature shrinks into a footer row and stops being a note from a person. And the slab needs its own corner clipping for the terminal half, which means new radius maths.

## 3. Recommendation

**Option A.** It is the only option where cloud is visibly primary (width, padding, glow, gradient button) while self-host still keeps its full sentence. The terminal makes self-host concrete instead of a grey button, the star pill sits where "Open source" is claimed, and the note ends the page on a person. Everything below specifies A.

## 4. Structure (Option A)

```
section#ways.final-call.page-width.reveal  aria-labelledby="final-title"
  h2#final-title.section-title                       "Get todz on your Mac."
  ul.way-list
    li.way-card.way-card-cloud.glass
      div.way-head
        svg.way-icon (glyphHtml SiteGlyph.Icon, aria-hidden)
        h3.way-title                                 "todz cloud"
        span.way-badge.way-badge-free                "Free"   (::before mint dot)
      ul.way-points
        li.way-point ×3                              (::before ✓ in a mint disc)
      a.download-button.way-cta  href=/download download   "Download for Mac"
      p.download-note  … a.download-note-link href=DOCS_INSTALL_URL "Install steps"
    li.way-card.glass
      div.way-head
        h3.way-title                                 "Self-host"
        span.way-badge                               "Open source"
      p.way-body                                     selfHost.body
      figure.terminal.way-terminal
        figcaption.visually-hidden                   selfHost.terminal.label
        div.terminal-bar (3 .terminal-dot, aria-hidden)
        pre.terminal-body > code
          span.terminal-line: span.terminal-prompt "$" + span.terminal-command (unbrokenWordsHtml)
          span.terminal-line.terminal-result         selfHost.terminal.ready
          span.terminal-line.terminal-result         selfHost.terminal.next
      div.way-actions
        a.way-link href=DOCS_SELF_HOST_URL           "Server setup guide" + span.way-link-arrow[aria-hidden] "→"
        starPillHtml(stars)
  p.ways-note                                        ways.note
  p.signature.glass
    span.signature-line                              signature.line
    span.signature-sign  "— " a.signature-link href=AUTHOR.url rel=noopener  AUTHOR.name
                         SIGNATURE_SWASH (svg, aria-hidden)
```

- `finalCallHtml(stars)` and `waysHtml(stars)` take the stars like `heroHtml` does, and `landingHtml` passes them through.
- `.final-icon` and its glyph call leave the panel. `.final-icon` stays in the stylesheet only if something else uses it; today nothing else does, so it goes.
- `.terminal-word`, `.terminal-prompt`, `.terminal-command`, `.terminal-result` and `unbrokenWordsHtml` are reused as they are. Inside `.way-terminal`, `.terminal-result` drops its `⎿` lead-in and its 5ch indent, and both result lines take a 2ch indent under the `$` (see the CSS below).
- `SIGNATURE_SWASH` is a new constant in `site-glyphs.ts`, shaped like `MENU_BAR_GLYPH`: `<svg class="signature-swash" viewBox="0 0 120 12" aria-hidden="true" focusable="false"><path d="M2 9 C 28 3, 52 11, 78 6 S 108 3, 118 5" pathLength="1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`. Presentation attributes are not `style` attributes, so the CSP is unaffected. It is a pen stroke, not an imitation of anyone's handwriting.
- `LINK_ARROW = '→'` sits at the top of `landing-page.ts`, like `STAR_GLYPH` in `star-pill.ts`.

## 5. States

| State | What shows |
|---|---|
| Download | Always available: `/download` redirects to the latest DMG server-side, and the panel is server-rendered with no loading or error state of its own. The button is a plain link, so no JS is needed. |
| Stars `null` (GitHub fetch failed or timed out) | Pill without the count segment: `[GH] Star on GitHub`. The actions row keeps its layout; the pill is just shorter. |
| Stars `0` | `[GH] Star on GitHub ★ 0`. The count-up runs 0 → 0, which is a no-op. The `★` stays `--color-text-muted`, so the 0 never shouts. The count is tabular, and `.star-count` gets `min-width:1ch` so "0" is never a sliver. |
| Stars 1–999 (`7`, `42`, `312`) | `★ 7`, `★ 42`, `★ 312`, counting up once when the pill enters the viewport (existing `STAR_COUNT_SCRIPT`, which observes every `.star-count` on the page, so this pill gets its own count-up). |
| Stars ≥ 1000 | Compact: `★ 1.2k`, `★ 12.3k` (`formatStars`). |
| Count-up running | `.star-count[data-counting]`: the final number is hidden and the live number is shown in the same grid cell, so the pill width never jitters. |
| Reduced motion | Final number printed, no count-up, swash drawn, no reveal. |
| Pill width | It changes by at most about 4ch between `null` and `12.3k`. It is the last item in `.way-actions` (a wrapping row), so the guide link never moves. The 5fr column at 1280 (396 px inside) and 390 px are both too narrow for the link and the pill on one line, so the pill sits on its own line under the link at its natural width, left-aligned, never stretched. It shares the line only at widths where both fit. |

## 6. Copy (`landing-copy.ts`)

`ways.cloud.body` becomes `ways.cloud.points`. `ways.selfHost` gains `terminal`. `final.title`, `ways.note`, `signature.*`, `download.note` and `download.noteLink` are unchanged, and no copy is invented:

```ts
ways: {
  cloud: {
    title: 'todz cloud',
    badge: 'Free',
    points: ['Sign in with your email.', 'Synced across your Macs and agents.', 'Nothing to run.'],
    cta: 'Download for Mac',
  },
  selfHost: {
    title: 'Self-host',
    badge: 'Open source',
    body: 'Run the server on your own Cloudflare account. Same app: switch the server in Settings.',
    cta: 'Server setup guide',
    terminal: {
      label: 'The deploy step of the self-host guide',
      command: 'pnpm --filter @todz/api server:deploy',
      ready: 'todz server ready: https://api.example.com',
      next: '→ paste it in todz › Settings › Server',
    },
  },
  note: 'The app is the same either way, and updates itself.',
},
```

- The prompt `$` reuses `LANDING_COPY.terminal.shellPrompt`.
- `command` is the real script: `apps/api/package.json` declares `server:deploy`, and `apps/docs/self-host.mdx` step 4 runs exactly this line.
- `ready` is the opening of the real ready line from `apps/api/scripts/server/ready-line.ts`, with the guide's own example origin.
- `next` is the closing of the same line. The middle (server version, minimum app version) is left out on purpose, so it fits 390 px.
- Signature: `signature.line` stays "Built by a developer, for developers and AI tinkerers.". `signature.name` stays `AUTHOR.name`, and the red test on this branch makes that "Dhyego Calota" with `AUTHOR.url` `https://dhyegocalota.com.br`. The em dash stays fixed markup. The first name is never shown alone.

## 7. CSS (`site-style.ts`)

Change:

```
.way-list            gap:var(--space-4) (unchanged), margin-top:var(--space-5) (was --space-6: no icon above now)
.way-card            padding:var(--space-4) at 390; var(--space-5) from NARROW (same steps as .benefit-card)
.way-body            color:var(--color-text) (was muted; AA on glass over the light wallpaper hotspot)
.way-cta             margin-top:auto; align-self:stretch   (full card width at every size; replaces margin-top:var(--space-2))
.ways-note           color:var(--color-text); font-weight:500 (was muted on raw wallpaper)
.final-call          padding:var(--space-7) var(--space-4) at 390 (was --space-8); from NARROW var(--space-8) var(--space-6)
.final-call .section-title  margin-top:0 (the icon above it is gone)
.signature           becomes the note (see below); its ::before rule is deleted
@media NARROW        delete .way-list{grid-template-columns:repeat(2, 1fr)}
@media WIDE          add    .way-list{grid-template-columns:7fr 5fr;gap:var(--space-5)}
```

Add (light first; nothing here differs by scheme except through existing tokens):

```
.way-card-cloud{box-shadow:var(--glass-edge), var(--glow-mint), var(--shadow-glass)}
  from NARROW: padding:var(--space-6)
.way-icon{flex:none;width:40px;height:40px;border-radius:10px;box-shadow:0 10px 24px rgb(27 42 158 / 0.3)}
.way-badge-free::before{content:'';display:inline-block;width:6px;height:6px;margin-right:6px;border-radius:50%;background:var(--color-mint);box-shadow:0 0 0 3px rgb(140 247 208 / 0.28);vertical-align:middle}
.way-points{display:grid;gap:var(--space-2);padding:0;list-style:none}
.way-point{display:grid;grid-template-columns:20px 1fr;gap:var(--space-3);align-items:start}
.way-point::before{content:'✓';display:grid;place-items:center;width:20px;height:20px;margin-top:2px;border-radius:50%;background:var(--color-mint);color:var(--color-terminal);font-size:0.75rem;font-weight:700}
.way-card-cloud .download-note{margin-top:0;color:var(--color-text)}
.way-terminal{align-self:stretch;border-radius:var(--radius-control);box-shadow:inset 0 0 0 1px rgb(255 255 255 / 0.06), var(--shadow-card)}
.way-terminal .terminal-bar{padding:var(--space-3) var(--space-4) 0}
.way-terminal .terminal-dot{width:10px;height:10px}
.way-terminal .terminal-body{padding:var(--space-3) var(--space-4) var(--space-4)}
.way-terminal .terminal-line + .terminal-line{margin-top:var(--space-1)}
.way-terminal .terminal-command{color:var(--color-terminal-text);-webkit-user-select:all;user-select:all}
.way-terminal .terminal-result{padding-left:2ch}
.way-terminal .terminal-result::before{content:none}
.way-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--space-3);align-self:stretch;margin-top:auto}
.way-link{display:inline-flex;align-items:center;gap:var(--space-2);min-height:var(--size-tap);font-weight:600;color:var(--color-text);text-decoration:none;border-radius:var(--radius-control)}
.way-link:hover{text-decoration:underline;text-underline-offset:0.2em}
.way-link-arrow{transition:transform var(--duration-quick) var(--ease-out)}
.way-link:hover .way-link-arrow{transform:translateX(3px)}
.star-count{min-width:1ch}
.signature{margin-top:var(--space-5);max-width:var(--measure-form);padding:var(--space-4) var(--space-5);border-radius:var(--radius-control);font-family:var(--font-rounded);color:var(--color-text);text-align:left;rotate:-1deg;box-shadow:var(--glass-edge), var(--shadow-card)}
.signature-line{display:block}
.signature-sign{display:block;margin-top:var(--space-2);text-align:right}
.signature-link{font-weight:600;color:var(--color-text);text-decoration:none}    (unchanged)
.signature-swash{display:block;width:96px;height:10px;margin:2px 0 0 auto;color:var(--color-accent)}
```

Motion (inside the existing `prefers-reduced-motion: no-preference` block, beside `.reveal`):

```
@supports (animation-timeline: view()){
.signature-swash path{stroke-dasharray:1;stroke-dashoffset:1;animation:draw linear both;animation-timeline:view();animation-range:entry 40% cover 40%}}
@keyframes draw{to{stroke-dashoffset:0}}
```

Without `animation-timeline` support, or under `reduce`, the swash is simply drawn. The `rotate:-1deg` on the note is static and is not motion.

Fallbacks (append the new classes to the existing lists):

- `forced-colors: active`: add `.way-terminal` beside `.terminal` (Canvas plus a CanvasText border). Add `.way-point::before,.way-badge-free::before{background:CanvasText;color:Canvas;box-shadow:none}`. Add `.way-card-cloud{box-shadow:none}`, since the glow carries no meaning.
- `prefers-reduced-transparency` and no backdrop-filter: `.signature.glass` and both cards are already `.glass`, so they fall back to `--color-surface` without new rules.

### Token to add (needs the owner's yes)

`--glow-mint:0 0 0 1px rgb(140 247 208 / 0.6), 0 0 40px rgb(140 247 208 / 0.35)`, the same mint ring that `.star-pill:hover` writes inline today, with a wider and softer halo for a large surface. It is the same in both schemes. If the owner declines, the developer writes the shadow inline on `.way-card-cloud`, as `.star-pill:hover` already does. No colour, radius, spacing or font token is new: `10px` on `.way-icon` follows the existing `.brand-icon` 28 px / 7 px ratio, and `-1deg` sits in the rule like `scale(0.98)` does elsewhere.

## 8. Accessibility

- **Landmarks and headings.** One `section` labelled by the h2. Each card is an `li` with an h3, and the cloud points are a nested `ul`, so a screen reader announces "list, 3 items". The badges are plain text after the h3 ("todz cloud, Free").
- **Focus order** (DOM order is the visual order at every width): Download for Mac → Install steps → Server setup guide → Star on GitHub → Dhyego Calota. The terminal is not focusable: it wraps and never scrolls, so it needs no `tabindex`. Every control is at least 44 px tall (`--size-tap`, `--size-capsule`). The focus ring is the global `:focus-visible`: 3 px `--color-focus` (#2F5BFF light, #8CF7D0 dark), at least 3:1 against both glass and wallpaper.
- **Names.** Download for Mac: "Download for Mac, link", and the `download` attribute starts the DMG. The guide link: "Server setup guide" (the arrow is `aria-hidden`). The pill: "Star on GitHub 12" (★ hidden, live count hidden). The name: "Dhyego Calota, link". The terminal: figure "The deploy step of the self-host guide", whose text reads in order.
- **Copy-friendliness.** `user-select:all` on the command, so one click selects the whole command and it pastes as a single line, because `unbrokenWordsHtml` joins the words with real spaces.
- **Contrast (light first).** These are estimates against the worst backdrop. The tester measures each with DevTools at 1280 and 390, in both schemes:

| Text or icon | On | Light | Dark |
|---|---|---|---|
| `--color-text` body, points, note, ways-note, signature | glass over the `#6AA6FF` hotspot (~#C6DDFF) / dark glass (~#1C2A67) | ≈ 12:1 | ≈ 13:1 |
| `--color-text-muted` (now only the ★ glyph) | glass | ≈ 4.3:1 worst case, 5.5:1 typical | ≈ 6.3:1 |
| `--color-text` badge text | `--color-chip` on glass | ≈ 11:1 | ≈ 12:1 |
| White on `--gradient-action` (Download) | #2F5BFF → #1B2A9E | ≥ 5.2:1 | same |
| `--color-terminal-text` command | `--color-terminal` #0E1020 | ≈ 15:1 | same |
| `--color-terminal-prompt` mint `$`, ✓ | #0E1020 | ≈ 14.7:1 | same |
| `--color-terminal-muted` result lines | #0E1020 | ≈ 7.6:1 | same |
| ✓ #0E1020 on the mint disc | #8CF7D0 | ≈ 14.7:1 | same |
| Swash `--color-accent` (decorative) | glass | n/a | n/a |

  The muted ★ is the one tight pair in light mode. It is a decorative glyph (`aria-hidden`) beside a number in `--color-text`, so it is exempt. If the owner wants it at AA anyway, `.star-glyph` takes `--color-text`.
- **Links inside the terminal.** There are none, deliberately: `--color-link` #2F5BFF on #0E1020 is ≈ 3.6:1 and would fail.
- **Motion.** The reveal, the swash draw and the count-up all sit behind `prefers-reduced-motion: no-preference`. The arrow nudge on hover is a 120 ms transform, which the global `reduce` rule already cuts to colour-only transitions.

## 9. Tests the developer moves (`apps/api/test/free-hero.test.ts`)

- "two equal glass cards" becomes "a primary cloud card and a self-host card": `way-card way-card-cloud glass` once, `way-card glass` once.
- The cloud card: its three points in order, `href="/download"` with `download`, and `download.note` with `DOCS_INSTALL_URL` inside the cloud card.
- The self-host card: `selfHost.body`, the terminal command equal to `` `pnpm --filter @todz/api ${script}` `` where `script` is a key of `apps/api/package.json` `scripts` (read the manifest, as `server/ready.test.ts` does), the guide link, and `starPillHtml(stars)` inside the card for `null`, `0`, `42` and `1234`.
- The `.way-list{grid-template-columns:repeat(2, 1fr)}` pin becomes `.way-list{grid-template-columns:7fr 5fr`.
- The signature: the markup above with "Dhyego Calota" and `https://dhyegocalota.com.br`. The `.signature::before{` pin is deleted, and `.signature-swash{` is added.
- The panel no longer contains `final-icon`.

## Owner decisions

