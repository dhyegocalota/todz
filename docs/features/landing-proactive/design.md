# Design: todz.app says how proactive todz is

**Author:** `frontend-designer`, 2026-11-26. **Owner's words (2026-11-26):** "deixa hiper claro na landing page o quão proactive ele é… óbvio, com frontend-designer, de forma sexy". **Recommendation: Option B, the day rail card.**

Read: `apps/api/src/site/landing-page.ts` (`benefitsHtml`, `benefitHtml`, `howItWorksHtml`), `landing-copy.ts`, `site-style.ts` (`SITE_STYLE`), `site-glyphs.ts` (`MENU_BAR_GLYPH`, `SiteGlyph.Icon`), `landing-markdown.ts`, `landing-shots.ts`, `apps/api/src/mcp-copy.ts` (`MCP_COPY.agentNudge`, `McpToolName.Next`), `apps/api/scripts/emails/day-email-copy.ts`, `apps/macos/Copy/MenuBarCopy.swift`, `apps/macos/Todz/Shortcuts/TodzShortcuts.swift`, and the specs of `morning-glance`, `day-close`, `day-email`, `agent-nudge`, `menu-bar-ribbon`, `day-temperature`, `siri-shortcuts`, `focus-switch-defaults`. Design language: `docs/features/landing/design.md`, `docs/features/landing-final-panel/design.md`.

**Before screenshots: not taken.** Playwright MCP's browser (`chrome-for-testing`) is not installed on this machine, and installing it is an ask-first step. The recorder takes them before the developer starts, at `.pr-media/landing-proactive/design/`: `before-1280-light.png`, `before-1280-dark.png`, `before-390-light.png`, `before-390-dark.png`, each a full-element shot of `section.benefits`. The "today" description below comes from the source.

## 0. What is on screen today, and the facts the copy must respect

- After the hero, `section.benefits` holds three equal glass cards: **Agents add tasks over MCP**, **Your menu bar and widgets**, **Works offline, syncs everywhere**. Nothing on the page says that todz acts on its own: every sentence describes something you open or ask for.
- No screenshot of the glance, the day close, the mail or the ribbon is served under `/landing/`. Option B draws its vignettes in HTML and CSS from existing tokens, so it adds no image bytes and nothing to the hero's LCP.
- Facts from the shipped specs, which the copy below stays inside:
  - **Morning glance** fires on the first wake or unlock of the day, not at a set hour; it shows Today for about five seconds. The vignette's `09:00` is an example, and its line says "wake your Mac".
  - **Close the day** defaults to 18:00, with Done, Tomorrow and No date on each row (`MenuBarCopy.done`, `.tomorrowHelp`, `.noDate`).
  - **Your day** mail defaults to 07:00; its subject is `Your day: N due`; a reply from the sign-in address adds a task.
  - **Agent nudge**: `next` starts with `Today here: 3 due. Start with T-12?` (`MCP_COPY.agentNudge.line`).
  - **Ribbon** is off by default; **day temperature** fades the count after noon; **Siri** answers "What's left today in todz".
  - **Respect Focus gates the Mac surfaces only** (glance, day close, ribbon, temperature). The agent nudge and the day mail are not gated by Focus (focus-switch-defaults spec, Non-goals; ADR 0054 §5). "Respect Focus quiets them all" would be false, so the note says it keeps **your Mac** quiet. Open question 1 asks the owner to confirm the wording.

## 1. Options

### Option A: the glance card becomes "It comes to you"

```
1280: the same three columns, the middle card swapped
┌ agents ────────┐ ┌ glass card ────────────┐ ┌ offline ───────┐
│ [crop shot]    │ │ ┌ well 160 ──────────┐ │ │ [glyph]        │
│                │ │ │ 07:00 Your day: 3 due│ │ │                │
│                │ │ │ 09:00 Today · 3 left │ │ │                │
│                │ │ │ 18:00 Close the day  │ │ │                │
│                │ │ └────────────────────┘ │ │                │
│ Agents add …   │ │ todz doesn't wait to   │ │ Works offline… │
│                │ │ be opened.             │ │                │
│                │ │ A morning mail, a …    │ │                │
└────────────────┘ └────────────────────────┘ └────────────────┘
```

- **For:** zero added height; nothing moves on the page; the smallest diff (copy plus one well).
- **Against:** the line the owner wants "hiper claro" is a 20 px card title among two peers, the same weight as "Works offline". The agent nudge, the ribbon, temperature, Siri and the switch note do not fit in a 352 px card with one sentence, so most of the story is cut. It is not obvious, and it is not the "sexy" the brief asks for.

### Option B: the day rail card (recommended)

The glance card leaves the benefits list. In its place, a full-width glass card leads the list: the sharp line as its title, a wallpaper well holding a timeline from 07:00 to 18:00 with four small glass vignettes, a row of three chips (ribbon, temperature, Siri) and the switch note. Agents and offline follow as a two-column row. It sits inside `section.benefits`, so the page still has the same four sections in the same order.

```
1280 (page-width 1152; card padding 24 → 1104 inside)
┌ li.benefit-card.benefit-card-day.glass.reveal, grid-column 1 / -1 ────────────────────────────┐
│ IT COMES TO YOU                                        Each one is a switch in Settings.      │ eyebrow accent; note right,
│ todz doesn't wait to be opened.                        Respect Focus keeps your Mac quiet     │ max 30ch, --text-small
│                                                        during a Focus.                        │
│ ┌ .benefit-well.day-well: --gradient-wallpaper, padding 24 ──────────────────────────────────┐ │
│ │ ●━━━━━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━●              │ │ track: mint fill grows
│ │ ┌ vignette glass ──────┐ ┌ vignette glass ──────┐ ┌ vignette glass ──────┐ ┌ vignette ───┐ │ │ left → right on scroll
│ │ │ 07:00                │ │ 09:00                │ │ 10:30                │ │ 18:00       │ │ │
│ │ │ [■✓] Your day: 3 due │ │ Today        3 left  │ │ ┌ terminal ────────┐ │ │ 3 left      │ │ │
│ │ │ Reply to add a task. │ │ ○ Review PR          │ │ │> What's next in… │ │ │ T-12 Review │ │ │
│ │ │                      │ │ ○ Ship the beta      │ │ │⏺ todz - next     │ │ │ (Done)(Tomo-│ │ │
│ │ │                      │ │                      │ │ │⎿ Today here: 3 … │ │ │ rrow)(No d.)│ │ │
│ │ │ Your day, by email   │ │ Morning glance       │ │ └──────────────────┘ │ │ Close the   │ │ │
│ │ │ Reply to add a task. │ │ Wake your Mac: Today │ │ Your agents know     │ │ day         │ │ │
│ │ │                      │ │ shows for a few sec. │ │ Ask what's next: …   │ │ Done, Tom…  │ │ │
│ │ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘ └─────────────┘ │ │
│ └────────────────────────────────────────────────────────────────────────────────────────────┘ │
│ (Menu bar ribbon [✓✦] 3 left · next: T-12 Review PR) (Day temperature  The count fades after   │ chips, glass-edge, wrap
│  noon.) (Siri  “What's left today in todz?”)                                                   │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
┌ agents (1fr) ─────────────────────────────┐ ┌ offline (1fr) ────────────────────────────┐
└───────────────────────────────────────────┘ └───────────────────────────────────────────┘
```

- **For:** the line is set at `--text-section` (the `h2` size), the first thing after the stage, so a skim reads "todz doesn't wait to be opened" before anything else below the fold. The timeline makes "proactive" concrete in four times of day, every surface the brief names gets a mention, and the scroll-drawn mint track is the motion moment the page lacks between the hero and the terminal. No section is added, no image is added, and no script is added.
- **Against:** the benefits block grows. Estimated net height: about **+460 px at 1280** (day card ≈ 460 px, plus the agents and offline row ≈ 330 px, replacing one row of three cards ≈ 330 px) and about **+480 px at 390** (day card ≈ 780 px replacing the glance card ≈ 300 px). The glance card's own sentence ("Today is one click away, and widgets check tasks off…") leaves the page. The hero stage still shows the popover and the widget, and `howItWorks.step3` still says "It shows up in your menu bar and widgets", so the claim stays on screen.

### Option C: the stage plays the day

The hero `desk-stage` loops a twelve-second CSS sequence: the menu strip shows a clock (07:00 → 09:00 → 18:00), and HTML vignettes of the mail, the glance and the day close fade over the window shot in turn.

- **For:** zero added height, and the most cinematic option: the product shows its day above the fold.
- **Against:** the hero says "shared with your agents"; a looping day story competes with it for the first screen. Content that moves for more than five seconds needs a pause control (WCAG 2.2.2), which means a button and a script under the strict CSP. The vignettes cover the window shot, the page's best image. Reduced motion collapses it to one frame, which hides three of the four moments. It touches the hero, the riskiest block for LCP and for the existing order and hero tests.

### Recommendation

**Option B.** It is the only option where the line is impossible to miss and every proactive surface is named, while the landing keeps its four sections and adds no image, script or new section. It pays for that with roughly one extra half-screen, which it partly offsets by removing the glance card. Everything below specifies B.

## 2. States

| State | What shows |
|---|---|
| Default (motion allowed, `animation-timeline: view()` supported: Chrome, Edge, Safari 26) | The card rises in like the other cards (`.reveal`). As it crosses the viewport, the mint fill of the track draws from 07:00 to 18:00; each dot lights mint with a glow as the fill reaches it, and its vignette lifts from dim to full. Scrolling back reverses it, because the timeline follows the scroll. |
| Motion allowed, no scroll timeline (Firefox) | Static and complete: track filled, every dot lit, every vignette at full opacity, exactly like `.reveal` cards today. |
| Reduced motion | The same static, complete state. No scroll-linked animation and no transform; the global `reduce` rule keeps only colour and opacity transitions. |
| Light | Tokens only: `--glass-*` light, `--gradient-wallpaper` light (blue and pink), mint fill on the white track. |
| Dark | The token switch: dark glass, the dark wallpaper (cobalt and mint), `--color-accent` `#7C95FF` for the eyebrow, `--color-text` `#F2F4FF`. The terminal vignette is `--color-terminal` in both schemes. |
| 390 px | The rail is vertical on the left of the well; the four vignettes stack, each beside its dot; chips stack full width; the note sits under the title (section 6). |
| Desktop (≥ 1024 px) | The rail is horizontal; four vignettes in a row; the note sits to the right of the title; agents and offline share the next row (section 6). |
| 640–1023 px | The vertical rail of 390, with vignettes at full card width; agents and offline stacked, as today. |
| JS off | No change: the card is server-rendered HTML and CSS and uses no script. |
| CSS off | An ordered list in reading order: time, title, sentence, for each stop; then the chips as a list; then the note. The mock text inside each vignette also prints (it is `aria-hidden`, not `display:none`), which duplicates a little, harmlessly. |
| Reduced transparency, no backdrop-filter | `.glass` already falls back to `--color-surface`; the vignettes and the card are `.glass`. |
| Forced colors | Card, well and vignettes become `Canvas` with a `CanvasText` border (existing `.glass`, `.benefit-well` rules); the track, dots and the day-close pills draw in `CanvasText` (section 4, new list entries). |

There are no loading, empty or error states: the card is static copy with no data.

## 3. Copy (`landing-copy.ts`)

`benefits.glance` is removed. `benefits.day` is added before `agents`. Strings that mirror the product are composed from their source where the source is importable, so the page cannot drift.

```ts
const EXAMPLE_DUE_COUNT = 3;
const EXAMPLE_SECOND_TASK_TITLE = 'Ship the beta';

benefits: {
  heading: 'Why todz',
  day: {
    eyebrow: 'It comes to you',
    title: "todz doesn't wait to be opened.",
    railLabel: 'A day with todz, from 07:00 to 18:00',
    email: {
      time: '07:00',
      subject: `Your day: ${EXAMPLE_DUE_COUNT} due`,
      title: 'Your day, by email',
      body: 'Reply to add a task.',
    },
    glance: {
      time: '09:00',
      heading: 'Today',
      count: `${EXAMPLE_DUE_COUNT} left`,
      rows: [EXAMPLE_TASK_TITLE, EXAMPLE_SECOND_TASK_TITLE],
      title: 'Morning glance',
      body: 'Wake your Mac: Today shows for a few seconds.',
    },
    agent: {
      time: '10:30',
      ask: "What's next in todz?",
      toolCall: `todz - ${McpToolName.Next} (MCP)`,
      toolResult: MCP_COPY.agentNudge.line({ summary: MCP_COPY.agentNudge.due(EXAMPLE_DUE_COUNT), taskId: formatShortId(EXAMPLE_TASK_NUMBER) }),
      title: 'Your agents know',
      body: "Ask what's next: they start with today.",
    },
    close: {
      time: '18:00',
      count: `${EXAMPLE_DUE_COUNT} left`,
      task: `${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
      actions: ['Done', 'Tomorrow', 'No date'],
      title: 'Close the day',
      body: 'Each task: Done, Tomorrow or No date.',
    },
    extras: {
      label: 'Also on your Mac',
      ribbon: { label: 'Menu bar ribbon', detail: `${EXAMPLE_DUE_COUNT} left · next: ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}` },
      temperature: { label: 'Day temperature', detail: 'The count fades after noon.' },
      siri: { label: 'Siri', detail: '“What’s left today in todz?”' },
    },
    note: 'Each one is a switch in Settings. Respect Focus keeps your Mac quiet during a Focus.',
  },
  agents: { … unchanged },
  offline: { … unchanged },
},
```

Rendered text, for review at a glance:

| Element | Text |
|---|---|
| Eyebrow | It comes to you |
| Title (`h3`, section size) | todz doesn't wait to be opened. |
| 07:00 mock | [todz icon] Your day: 3 due |
| 07:00 caption | **Your day, by email** · Reply to add a task. |
| 09:00 mock | Today · 3 left · ○ Review PR · ○ Ship the beta |
| 09:00 caption | **Morning glance** · Wake your Mac: Today shows for a few seconds. |
| 10:30 mock | `> What's next in todz?` · `⏺ todz - next (MCP)` · `⎿ Today here: 3 due. Start with T-12?` |
| 10:30 caption | **Your agents know** · Ask what's next: they start with today. |
| 18:00 mock | 3 left · T-12 Review PR · (Done) (Tomorrow) (No date) |
| 18:00 caption | **Close the day** · Each task: Done, Tomorrow or No date. |
| Chips | **Menu bar ribbon** [glyph] 3 left · next: T-12 Review PR · **Day temperature** The count fades after noon. · **Siri** “What’s left today in todz?” |
| Note | Each one is a switch in Settings. Respect Focus keeps your Mac quiet during a Focus. |

- Tone matches the page: short declaratives, a colon for the second beat ("Add the server: one command…").
- `EXAMPLE_TASK_NUMBER` and `EXAMPLE_TASK_TITLE` already exist at the top of `landing-copy.ts`; the two new constants sit beside them. `formatShortId`, `MCP_COPY` and `McpToolName` are already imported there.
- The mail subject mirrors `DAY_EMAIL_COPY.subject` in `apps/api/scripts/emails/day-email-copy.ts`. That file lives under `scripts/`, outside the Worker bundle; if the developer can import it from `src/site/` without pulling the email builder in, compose from it; if not, the literal stays and a test pins the two equal.
- `actions` mirror `MenuBarCopy.done` / the Tomorrow button / `MenuBarCopy.noDate`; the ribbon detail mirrors `MenuBarCopy.ribbonRemaining`; the Siri quote mirrors the first phrase of `TodzShortcuts`. Swift is not importable: a test pins each against `swiftCopyValue` (`tools/repository-shape/src/swift-copy.ts`), as other copy pins do.
- Times are 24-hour, as the app's Settings show the defaults (07:00, 18:00). 12-hour was considered and left out: the owner wrote "18:00", and the app does not localise these defaults on the landing.
- `landing-markdown.ts`: the markdown alternate lists `benefits.day` as `### todz doesn't wait to be opened.` followed by four `- 07:00 Your day, by email: Reply to add a task.` lines, the note, and drops `glance`.
- Not changing: `meta.*`, `hero.*`, `howItWorks.*`, `agents`, `offline`, the alt texts other than `alt.widgetRing`, which leaves with the glance card (the ring shot stays served if something else uses it; today nothing else does).

## 4. Structure and tokens (Option B)

```
section.benefits.page-width                              (unchanged)
  h2#benefits-title.visually-hidden                      "Why todz"
  ul.benefit-list
    li.benefit-card.benefit-card-day.glass.reveal
      div.day-head
        div
          p.section-eyebrow                              day.eyebrow
          h3.section-title.day-title                     day.title
        p.day-note                                       day.note
      div.benefit-well.day-well
        ol.day-rail  aria-label=day.railLabel
          li.day-stop  (×4: email, glance, agent, close; ::before track base and ::after mint fill on all but the last)
            span.day-dot  aria-hidden
            div.day-vignette.glass
              time.day-time  datetime="07:00"            time
              div.day-mock  aria-hidden="true"           the mock (per stop, below)
              p.day-stop-title                           title
              p.day-stop-body                            body
      ul.day-extras  aria-label=extras.label
        li.day-extra  (×3)
          span.day-extra-label                           label
          span.menu-strip-item (ribbon only)             MENU_BAR_GLYPH + detail
          span                                           detail (temperature, Siri)
    li.benefit-card.glass.reveal                         agents (unchanged)
    li.benefit-card.glass.reveal                         offline (unchanged)
```

Mocks (all inside `div.day-mock[aria-hidden=true]`):

- **email:** `glyphHtml({ glyph: SiteGlyph.Icon, className: 'day-mail-icon' })` + `span.day-mail-subject`.
- **glance:** `span.day-mock-head` (heading left, count right) + two `span.day-row` (open circle `::before`).
- **agent:** `div.terminal.day-terminal > pre.terminal-body > code` with `span.terminal-line` › `span.terminal-prompt` (`LANDING_COPY.terminal.askPrompt`) + `span.terminal-ask`; `span.terminal-line.terminal-call`; `span.terminal-line.terminal-result`.
- **close:** `span.day-mock-head` (count) + `span.day-row` (task) + `span.day-actions` › three `span.day-action` (spans, never buttons: nothing here is interactive).

Rendering: one `dayStopHtml({ time, mock, title, body })` beside `benefitHtml`, the four mocks as four small functions, and `benefitsHtml` emitting the day card first. No `style=""` attribute anywhere: every position, delay and range is a class in the hashed `<style>`, so the CSP is untouched (`siteContentSecurityPolicy` hashes `SITE_STYLE` as it is).

### Tokens reused (all from `SITE_STYLE`; no new token)

| Use | Token |
|---|---|
| Card | `.benefit-card` + `.glass`: `--glass-sheen`, `--glass-fill`, `--glass-blur`, `--glass-edge`, `--shadow-card`, `--radius-card` |
| Well | `.benefit-well`: `--gradient-wallpaper`, `calc(var(--radius-card) - var(--space-2))`; `.day-well` sets `height:auto` and `padding:var(--space-5)` (`--space-4` below 640) |
| Vignettes | `.glass` with `box-shadow:var(--glass-edge), var(--shadow-card)` (as `.way-card`), `--radius-control`, padding `--space-3` (`--space-4` from 1024) |
| Eyebrow and title | `.section-eyebrow` (`--text-eyebrow`, `--color-accent`), `.section-title` (`--text-section`, 1.1, -0.025em, 700) with `margin-top:var(--space-2)` |
| Time | `--text-eyebrow`, weight 700, `font-variant-numeric:tabular-nums`, `--color-text` |
| Stop title / body | 600 `--text-body` / `--text-small`, both `--color-text` (the final panel's rule: no muted text on glass over the wallpaper) |
| Note | `--text-small`, `--color-text-muted` (it sits on the card glass over `--color-page`, not over the wallpaper: 5.5:1 as in the landing design table) |
| Track | 2 px line, base `--color-hairline`; fill `--color-mint` with `--glow-mint` |
| Dots | 12 px circle, base `--color-surface` with `--glass-edge`; lit `--color-mint` with `--glow-mint` |
| Day-close pills | `--color-chip` background, `--radius-pill`, `--text-eyebrow` 600, `--color-text`; the first (Done) gets the mint disc look of `.way-point::before` |
| Glance rows | `::before` 10 px ring `inset 0 0 0 1.5px var(--color-text-muted)`, like the app's open circle |
| Mail icon | 20 px, `border-radius:5px` (the `.brand-icon` 28/7 ratio) |
| Agent mock | `.terminal`, `.terminal-body`, `.terminal-line`, `.terminal-prompt`, `.terminal-ask`, `.terminal-call`, `.terminal-result`; `.day-terminal` joins the existing `.way-terminal` selectors (radius, bar, padding, line gap), with no terminal bar and `--text-small` |
| Ribbon chip | `.menu-strip-item` + `MENU_BAR_GLYPH` (`.menu-glyph`) |
| Extras chips | `--radius-pill`, `box-shadow:var(--glass-edge), var(--shadow-card)` (as `.star-pill`), padding `--space-2` `--space-4`, `--text-small`; label 600 `--color-text`, detail `--color-text` |
| Spacing | `--space-2` … `--space-6`; gaps `--space-3` (stack) and `--space-4` (row) |
| Motion | `--distance-rise`, `--ease-out`, the existing `rise` keyframes |
| Breakpoints | `NARROW_BREAKPOINT` (40rem) and `WIDE_BREAKPOINT` (64rem), no new one |

Fallback lists to extend, not new rules: `forced-colors` gains `.day-dot,.day-stop::before,.day-stop::after{background:CanvasText;box-shadow:none}` and `.day-action{border:1px solid CanvasText;background:Canvas}`; `.day-terminal` joins `.terminal,.way-terminal`.

## 5. Motion

All of it lives inside the existing `@media (prefers-reduced-motion: no-preference)` → `@supports (animation-timeline: view())` block, beside `.reveal` and the signature swash, and every keyframe animates **from** the dim or empty state, so the resting state is complete.

| Element | Animation | Timeline and range |
|---|---|---|
| Card | the existing `.reveal` rise | `view()`, `entry 0% entry 60%` (unchanged) |
| Track segment n (`.day-stop:nth-child(n)::after`, n = 1…3) | new `@keyframes fill{from{transform:scaleX(0)}}`, origin left; below 1024 `@keyframes fill-down{from{transform:scaleY(0)}}`, origin top | named timeline `view-timeline-name:--day` on `.day-well`; `animation-timeline:--day`; ranges `cover 24%–31%`, `35%–42%`, `46%–53%`; `linear` |
| Dot n | new `@keyframes light{from{background:var(--color-surface);box-shadow:var(--glass-edge)}}` | `--day`; four `.day-stop:nth-child(n) .day-dot` rules with ranges `cover 20%–24%`, `31%–35%`, `42%–46%`, `53%–57%`, so each dot lights as the segment before it lands |
| Vignette n | the existing `rise` keyframes plus `opacity` from 0.4 | `--day`; same four ranges, each widened by 6% |

- No time-based or infinite animation: the day is scrubbed by the scroll, so it never moves on its own and never needs a pause control.
- No layout property animates: `transform` and `opacity` only, plus the dots' background and shadow.
- **Reduced-motion fallback:** nothing above is declared outside the `no-preference` block, so under `reduce` the track is filled, the dots are lit and the vignettes are at rest. The global `reduce` rule already limits transitions to colour and opacity at `--duration-quick`.
- **No-support fallback:** the same complete state.

## 6. Layout notes

### Desktop (≥ 1024 px, `WIDE_BREAKPOINT`)

- `.benefit-list` changes from `repeat(3, 1fr)` to `repeat(2, 1fr)`; `.benefit-card-day{grid-column:1 / -1}`.
- `.day-head`: `display:flex; justify-content:space-between; align-items:flex-end; gap:var(--space-6)`; `.day-note{max-width:30ch;text-align:right}`.
- `.day-well{margin-top:var(--space-5)}`. `.day-rail`: `display:grid; grid-template-columns:repeat(4, 1fr); gap:var(--space-4); padding-top:var(--space-6)` (room for the track). Each dot sits in the stop's top-left, at `var(--space-3)` in from the vignette edge, so the four dots line up with the four time labels.
- The track is drawn per segment, never as one measured line: each `.day-stop:not(:last-child)` carries a `::before` (base) and `::after` (fill) that start at its own dot's centre and are `width:calc(100% + var(--space-4))` long, so each segment ends exactly at the next column's dot. No position depends on the column count.
- Vignettes have equal heights (`align-items:stretch`), the caption pinned to the bottom (`.day-stop-title{margin-top:auto}`), so the four titles line up.
- `.day-extras`: `display:flex; flex-wrap:wrap; gap:var(--space-3); margin-top:var(--space-5)`.
- Estimated card height ≈ 460 px; the agents and offline row keeps today's 160 px wells.

### 640–1023 px

- The vertical layout below, with `--space-5` card padding (the existing `.benefit-card` step) and `.day-well` padding `--space-5`.

### 390 px

```
390 (page-width 358; card padding 16 → 326 inside; well padding 16 → 294)
┌ day card ──────────────────────────┐
│ IT COMES TO YOU                    │
│ todz doesn't wait to be            │ --text-section ≈ 30 px, balanced,
│ opened.                            │ two lines
│ Each one is a switch in Settings.  │ note under the title, --text-small
│ Respect Focus keeps your Mac quiet │
│ during a Focus.                    │
│ ┌ well ──────────────────────────┐ │
│ │ ● ┌ 07:00 ───────────────────┐ │ │ dot column 12 px + gap 12;
│ │ ┃ │ [■✓] Your day: 3 due     │ │ │ vignette 270 px
│ │ ┃ │ Your day, by email       │ │ │
│ │ ┃ │ Reply to add a task.     │ │ │
│ │ ┃ └──────────────────────────┘ │ │
│ │ ● ┌ 09:00 … Morning glance ──┐ │ │ track vertical, fills top → bottom
│ │ ┃ └──────────────────────────┘ │ │
│ │ ● ┌ 10:30 terminal (wraps) ──┐ │ │ terminal pre-wrap, no h-scroll
│ │ ┃ └──────────────────────────┘ │ │
│ │ ● ┌ 18:00 (Done)(Tomorrow)   │ │ │ pills wrap to a second line
│ │   │ (No date) Close the day  │ │ │ if needed
│ │   └──────────────────────────┘ │ │
│ └────────────────────────────────┘ │
│ (Menu bar ribbon [✓✦] 3 left · …)  │ chips full width, stacked,
│ (Day temperature The count fades…) │ wrap inside
│ (Siri “What’s left today in todz?”)│
└────────────────────────────────────┘
[agents card]   [offline card]   stacked, unchanged
```

- `.day-rail`: `display:grid; gap:var(--space-3)`; each `.day-stop`: `display:grid; grid-template-columns:12px 1fr; gap:var(--space-3); align-items:start`; the dot aligns with the time label (`margin-top:var(--space-3)`).
- Track: the same per-segment `::before` / `::after` as desktop, turned vertical: from each dot's centre down `height:calc(100% + var(--space-3))` to the next dot, so no height maths.
- Glance mock shows one row at this width (`.day-row + .day-row{display:none}` below 640) to keep the vignette short; the caption still says the same.
- No horizontal scroll at 320 px or above: the terminal is `pre-wrap` and the pills wrap.
- Estimated card height ≈ 780 px.

## 7. Accessibility

- **Headings.** The sharp line is the card's `h3` under the existing hidden `h2` "Why todz", like the other cards; it is styled at the section size, not promoted to `h2`. Stops use `p`, not headings, to keep heading navigation to three entries in this section.
- **Reading order.** DOM order is the visual order at every width: eyebrow, title, note, then 07:00 → 18:00, then the chips. At 1024+ the note is visually right of the title and still read after it.
- **Names.** The rail is `ol[aria-label="A day with todz, from 07:00 to 18:00"]`; each stop reads "07:00, Your day, by email, Reply to add a task." through `time` + two `p`. Every mock is `aria-hidden="true"`, and each caption carries the full meaning without it. The chips list is labelled "Also on your Mac"; each reads "Menu bar ribbon, 3 left · next: T-12 Review PR" (the glyph is `aria-hidden`).
- **No new focus stops.** Nothing in the card is interactive: the day-close pills are spans, the terminal is not focusable and never scrolls. Focus order of the page is unchanged.
- **Contrast** (estimates on the worst backdrop; the tester measures each with DevTools at 1280 and 390, light and dark):

| Text or icon | On | Light | Dark |
|---|---|---|---|
| Title, captions, chips (`--color-text`) | vignette glass over the `#6AA6FF` hotspot / dark glass | ≈ 12:1 | ≈ 13:1 |
| Time (`--color-text`, 700) | vignette glass | ≈ 12:1 | ≈ 13:1 |
| Eyebrow (`--color-accent`) | card glass over `--color-page` | ≈ 4.7:1 | ≈ 7.2:1 |
| Note (`--color-text-muted`) | card glass over `--color-page` | ≈ 5.5:1 | ≈ 8.1:1 |
| Day-close pill text (`--color-text` on `--color-chip`) | vignette glass | ≈ 11:1 | ≈ 12:1 |
| Done pill ✓ (`--color-terminal` on mint) | `#8CF7D0` | ≈ 14.7:1 | same |
| Terminal ask / call / result | `--color-terminal` | 15:1 / 14.7:1 / 7.6:1 | same |
| Mint track and dots (decorative, non-text) | wallpaper | n/a; the lit state also adds `--glow-mint`, and the meaning never depends on it | n/a |

  The time label deliberately does not use `--color-accent`: `#2F5BFF` on glass over the light hotspot estimates near 4.6:1, too close to the line for 13 px text.
- **Motion:** section 5; scroll-linked only, no autoplay, reduced motion is static and complete.
- **Language:** `html lang="en"` already covers the English copy; the curly quotes in the Siri chip are text, not markup.

## 8. Notes for the plan

- Files the developer touches: `landing-copy.ts`, `landing-page.ts`, `site-style.ts`, `landing-markdown.ts`, their tests. `landing-shots.ts` keeps `WidgetRing` only if a test or page still needs it; otherwise it leaves with its PNG and WebPs from `apps/api/public/landing/`.
- Tests that move: `agentic-site.test.ts` and the markdown test lose `benefits.glance`; `site-pages.test.ts`'s section order is unchanged. New pins: the day card is the first `benefit-card`, four `day-stop`s in time order, the agent result equals `MCP_COPY.agentNudge.line(…)`, the Swift-mirrored strings equal their `swiftCopyValue`, no `style=` in the page, and the CSS keeps every `.day-*` animation inside the `no-preference` block.
- Media for the PR: the recorder shoots `section.benefits` at 1280 and 390, light and dark, with and without reduced motion, plus a short scroll video at 1280 showing the track drawing.

## 9. Open questions for the owner

1. **Respect Focus wording.** Your words were "Respect Focus quiets them all", but the switch gates only the Mac surfaces; the day mail and the agent nudge are not held by Focus (ADR 0054 §5). Recommended note: "Each one is a switch in Settings. Respect Focus keeps your Mac quiet during a Focus." Alternative: widen Respect Focus to the mail and the nudge, which is a product change for its own feature, not this one.
2. **The glance card leaves.** Option B replaces "Your menu bar and widgets"; its claim survives in the hero stage and in how-it-works step 3. Keep it as a third card in the row below instead (+330 px at 390, the row of two becomes three at 1024+)?

## Owner decisions

