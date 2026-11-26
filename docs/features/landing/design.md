# Landing: design

**Author:** `frontend-designer`, 2026-11-24. **Spec:** [spec.md](spec.md). **Sources:** the Glass mockups ([`glass-screens.html`](../../product/mockups/glass-screens.html)), the app's cobalt `#2F5BFF`, the mail brand (`apps/api/scripts/emails/email-style.ts`: `#0E1020`, `#4C6BFF → #1B2A9E`, mint `#8CF7D0`, `#F2F4FA`, `#161A33`, `#5B6285`), the brand marks in [`docs/brand/`](../../brand/).

**Before state.** `todz.app` serves nothing today (spec, Problem). The Playwright MCP walk of it was not taken: its browser is not installed on this machine, and installing it is an ask-first step. The before shot of the PR is "no page".

**No token file exists for the web.** The site gets its own token set below, declared once in `site-shell.ts`'s stylesheet as custom properties. Every value reuses a colour the app, the mockup or the mails already use; the one new colour is a contrast fix, marked ★.

## 1. Page structure

One page, five blocks, about one screen plus a short scroll. Sticky glass header; one `h1`.

### 1280 (recommended hero: option H-A)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ [■✓] todz                                       Self-host guide   [GitHub ⌂]    │ header 56, glass, sticky
├────────────────────────────────────────────────────────────────────────────────┤
│                         ( macOS · Coming soon )                                │ pill, 96 from header
│                Your tasks, shared                                              │ h1, 72px, centred,
│                   with your agents.                                            │ two lines, max 18ch
│      A native Mac to-do list that Claude Code, Codex and Cursor work over MCP. │ lead 21px, muted
│            ╭──────────────────────────────────────────────╮                    │
│            │ you@example.com               [Join the waitlist] │               │ glass capsule 56, 28rem
│            ╰──────────────────────────────────────────────╯                    │
│                    Only to tell you when todz opens.                           │ small, muted
│  ╭──────────────────────────────── stage 1152 × 600, r 28 ───────────────────╮ │
│  │ ░░ menu bar strip (glass 28) ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ [✓✦ 2] ░░░ │ │ decorative
│  │  ┌──────────────── main window 66% ───────────────┐ ┌── popover 27% ──┐   │ │ overlap 4%
│  │  │ Northwind │ Website relaunch     │ Fix broken… │ │ Northwind  Open │   │ │
│  │  │ Inbox  3  │ ○ Write the pricing… │ Project …   │ │ [Add a task  ]  │   │ │
│  │  │ Today  4  │ ○ Review the new …   │ Notes …     │ │ Today 4 left    │   │ │
│  │  │ …         │ ● Fix broken blog…   │ History …   │ └─────────────────┘   │ │
│  │  │           │                      │             │  ┌ medium widget ─┐   │ │ 28%, bottom 6%
│  │  └──────────────────────────────────────────────────┘  │ ✓ Today 5 left │  │ │
│  │                                                         └────────────────┘ │ │
│  ╰────────────────────────────────────────────────────────────────────────────╯ │ fold at ~800 cuts the stage
│                                                                                │ at about its first 260px
│  ╭ glass card ──────────╮ ╭ glass card ──────────╮ ╭ glass card ──────────╮    │ benefits: 3 columns,
│  │ [crop: tasks via CC] │ │ [ring widget]        │ │ [glyph: cloud ✓]     │    │ gap 24, well 160 tall
│  │ Agents add tasks     │ │ Your menu bar and    │ │ Works offline,       │    │ h3 20px
│  │ over MCP             │ │ widgets              │ │ syncs everywhere     │    │
│  │ one sentence         │ │ one sentence         │ │ one sentence         │    │ 16px muted
│  ╰──────────────────────╯ ╰──────────────────────╯ ╰──────────────────────╯    │
│                                                                                │ 96
│  How it works            ╭ terminal (#0E1020, r 20) ─────────────────────────╮ │ 5 / 7 columns
│  Connect once.           │ ● ● ●                                             │ │
│  Ask in plain words.     │ $ claude mcp add --transport http todz            │ │
│  ① Add the server  …     │   'https://api.todz.app/mcp' --header …           │ │
│  ② Ask your agent  …     │ > Add a todz task: review the PR                  │ │
│  ③ It's on your Mac …    │ ⏺ todz - add (MCP)(tasks: [{"title": "Review PR"}])│ │
│                          │   ⎿  Added T-12 Review PR                         │ │
│                          ╰───────────────────────────────────────────────────╯ │
│                                                                                │ 96
│  ╭ final call, stage wallpaper, r 28, centred: [✓ icon 64] h2, one line,   ╮  │ h2 40px
│  ╰ the same join capsule ──────────────────────────────────────────────────╯  │
├────────────────────────────────────────────────────────────────────────────────┤
│ [■✓] todz   © todz                                   Self-host guide · GitHub   │ footer 72, hairline top
└────────────────────────────────────────────────────────────────────────────────┘
```

### 375

```
┌───────────────────────────────────┐
│ [■✓] todz          Self-host  [⌂] │ header 52; "Self-host" short label
├───────────────────────────────────┤
│       ( macOS · Coming soon )     │ 48 from header
│        Your tasks, shared         │ h1 40px, centred, 3 lines max
│         with your agents.         │
│  A native Mac to-do list that     │ lead 17px
│  Claude Code, Codex and Cursor    │
│  work over MCP.                   │
│ ╭───────────────────────────────╮ │ input pill 52, full width
│ │ you@example.com               │ │
│ ╰───────────────────────────────╯ │
│ [      Join the waitlist        ] │ button pill 52, full width, gap 8
│  Only to tell you when todz opens.│
│ ╭ stage 343 × 400 ──────────────╮ │ window hidden < 640px
│ │ ░ menu bar strip ░░░░░ [✓✦ 2] │ │
│ │     ┌ popover 280 ──────┐     │ │ centred, top 40
│ │   ┌ medium widget 240 ┐ │     │ │ overlaps popover's bottom-left
│ │   │ ✓ Today   5 left  │─┘     │ │
│ │   └───────────────────┘       │ │
│ ╰───────────────────────────────╯ │
│ [card] [card] [card]  stacked     │ gap 16, well 140 tall
│ How it works, ① ② ③, terminal    │ steps above; pre-wrap, no h-scroll
│ [final call, stacked form]        │
│ [■✓] todz / links / © todz        │ footer stacked, centred
└───────────────────────────────────┘
```

Breakpoints: `40rem` (640: window appears in the stage, form becomes one capsule), `64rem` (1024: benefits go to three columns, how-it-works to 5/7 columns). Content measure `--measure-page` 72rem with `--space-5` side padding (16 below 640).

## 2. Components

All live in `apps/api/src/site/`, named by the class the stylesheet gives them; none exists today (the sign-in page uses system colours only and is not reused).

| Component | Where | Notes |
|---|---|---|
| `site-header` | shell | logo link (inline icon SVG + wordmark "todz", `ui-rounded` 700), nav: self-host link, GitHub icon link. Sticky, glass |
| `site-footer` | shell | logo, links, © line |
| `skip-link` | shell | first focusable, visible on focus |
| `eyebrow-pill` | hero | glass pill, cobalt dot |
| `join-form` | hero, final call | `form method=post action="/join#join"` (hero) / `"/join#final"` (final call): the fragment returns the reader to the form they used. Label, email input, submit button, note, notice slot |
| `desk-stage` | hero | wallpaper gradient, `menu-strip`, three `shot` frames |
| `menu-strip` | stage | glass bar, the `todz-menubar.svg` paths inline (`currentColor`) and the count "2"; `aria-hidden` |
| `shot` | stage, cards | `img` in a clipping frame: radius, shadow, optional crop box (wrapper `overflow:hidden`, image scaled and offset by percentages from the crop box in section 5) |
| `benefit-card` | benefits | glass card: visual well, `h3`, one sentence |
| `terminal` | how it works | `figure` > title bar dots + `pre > code`; glyph spans `aria-hidden` |
| `step-list` | how it works | `ol`, cobalt numerals in 24px circles |
| `final-call` | end | stage wallpaper, icon, `h2`, line, `join-form` |
| `prose` | /self-host | Markdown article styles |

Icon: the inline `todz-icon.svg` geometry (gradient square, white check, mint sparkle), 28px in the header, 64px in the final call. The lockup PNG is not used on the page: its dark plate and SVG text do not suit the light scheme.

## 3. Tokens

### Colour (light first; dark is a token switch under `prefers-color-scheme: dark`)

| Token | Light | Dark | Source |
|---|---|---|---|
| `--color-page` | `#F2F4FA` | `#070812` | mail page |
| `--color-surface` (opaque fallback of glass) | `#FFFFFF` | `#171A2E` | mail card |
| `--color-text` | `#161A33` | `#F2F4FF` | mail text |
| `--color-text-muted` | `#5B6285` | `#A9B0D6` | mail muted |
| `--color-hairline` | `rgb(22 26 51 / 0.08)` | `rgb(242 244 255 / 0.08)` | mockup `--line` |
| `--color-accent` | `#2F5BFF` | `#7C95FF` ★ | app accent; ★ dark text on `#070812` needs a lighter cobalt (7.2:1) |
| `--color-link` | `#2F5BFF` | `#8CF7D0` | mail link |
| `--color-focus` | `#2F5BFF` | `#8CF7D0` | |
| `--color-mint` | `#8CF7D0` | `#8CF7D0` | sparkle, notice dot; never text on light |
| `--gradient-action` | `linear-gradient(135deg, #2F5BFF, #1B2A9E)` | same | mail button; starts at `#2F5BFF`, not `#4C6BFF`, because white on `#4C6BFF` is 4.3:1 |
| `--color-on-action` | `#FFFFFF` | `#FFFFFF` | |
| `--color-terminal` | `#0E1020` | `#0E1020` | mail header |
| `--color-terminal-text` | `#E6E9F7` | same | |
| `--color-terminal-muted` | `#9AA3C7` | same | lockup tagline |
| `--color-terminal-prompt` | `#8CF7D0` | same | |
| `--gradient-wallpaper` | mockup `.wall`: `radial-gradient(75rem 44rem at 10% 115%, #6AA6FF, transparent 60%), radial-gradient(56rem 38rem at 95% -10%, #FFB6D9, transparent 55%), linear-gradient(160deg, #C9D8FF, #F4E3F1)` | `radial-gradient(70rem 40rem at 10% 115%, rgb(47 91 255 / 0.55), transparent 60%), radial-gradient(50rem 34rem at 95% -10%, rgb(140 247 208 / 0.16), transparent 55%), linear-gradient(160deg, #141A46, #0E1020)` | |
| `--gradient-aurora` (page top and bottom, behind the glass) | `radial-gradient(60rem 30rem at 50% -8rem, rgb(47 91 255 / 0.14), transparent 70%)` | `radial-gradient(60rem 30rem at 50% -8rem, rgb(47 91 255 / 0.28), transparent 70%)` | |

### Glass material

| Token | Light | Dark |
|---|---|---|
| `--glass-fill` | `rgb(255 255 255 / 0.62)` | `rgb(23 26 46 / 0.55)` |
| `--glass-sheen` | `linear-gradient(180deg, rgb(255 255 255 / 0.5), rgb(255 255 255 / 0.08))` | `linear-gradient(180deg, rgb(255 255 255 / 0.07), rgb(255 255 255 / 0))` |
| `--glass-blur` | `blur(34px) saturate(180%)` (mockup) | same |
| `--glass-edge` | `inset 0 0 0 1px rgb(255 255 255 / 0.6), inset 0 1px 0 rgb(255 255 255 / 0.9)` | `inset 0 0 0 1px rgb(255 255 255 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.12)` |
| `--glass-header-fill` | `rgb(242 244 250 / 0.72)`, blur 20px | `rgb(7 8 18 / 0.6)`, blur 20px |

Recipe: `background: var(--glass-sheen), var(--glass-fill); backdrop-filter: var(--glass-blur); box-shadow: var(--glass-edge), var(--shadow-glass)`. `@supports not (backdrop-filter: blur(1px))` and `prefers-reduced-transparency: reduce` swap the fill for `--color-surface`. `forced-colors: active` drops fills, shadows and gradients and keeps 1px `CanvasText` borders.

### Shadows

| Token | Light | Dark |
|---|---|---|
| `--shadow-glass` | `0 22px 60px rgb(30 40 90 / 0.24)` (mockup) | `0 30px 80px rgb(0 0 0 / 0.55)` |
| `--shadow-shot` | `0 30px 80px rgb(30 40 90 / 0.30), 0 0 0 0.5px rgb(0 0 0 / 0.15)` (mockup window) | `0 30px 80px rgb(0 0 0 / 0.6), 0 0 0 0.5px rgb(255 255 255 / 0.1)` |
| `--shadow-action` | `inset 0 1px 0 rgb(255 255 255 / 0.25), 0 8px 24px -8px rgb(47 91 255 / 0.55)` | same |

### Radius, spacing, type

- Radius: `--radius-control` 12px, `--radius-card` 24px, `--radius-stage` 28px, `--radius-shot` 12px (clips the white corners baked into the window and popover PNGs), `--radius-widget` 22px (the widget card crops), `--radius-pill` 999px.
- Spacing (4-based, as zapbip's): `--space-1` 4, `--space-2` 8, `--space-3` 12, `--space-4` 16, `--space-5` 24, `--space-6` 32, `--space-7` 48, `--space-8` 64, `--space-9` 96. Section gap `--space-9` (≥ 640) and `--space-8` (below).
- Fonts: `--font-sans: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` (the mails' stack); `--font-rounded: ui-rounded, 'SF Pro Rounded', var(--font-sans)` (wordmark, as in the lockup); `--font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`. No web fonts.
- Type scale:

| Token | Size | Line height / tracking / weight | Use |
|---|---|---|---|
| `--text-hero` | `clamp(2.5rem, 1.6rem + 3.6vw, 4.5rem)` | 1.04 / -0.035em / 700 | `h1` |
| `--text-section` | `clamp(1.75rem, 1.3rem + 1.6vw, 2.5rem)` | 1.1 / -0.025em / 700 | `h2` |
| `--text-title` | 1.25rem | 1.3 / -0.01em / 650 | `h3`, self-host `h2` |
| `--text-lead` | `clamp(1.0625rem, 0.95rem + 0.45vw, 1.3125rem)` | 1.5 / 0 / 400 | hero lead |
| `--text-body` | 1rem | 1.55 | body, inputs, buttons (600) |
| `--text-small` | 0.875rem | 1.5 | notes, footer, terminal at 375 |
| `--text-code` | 0.9375rem | 1.6 | terminal ≥ 640, code blocks |
| `--text-eyebrow` | 0.8125rem | 1 / 0.02em / 600 | pill |

- Measures: `--measure-page` 72rem, `--measure-hero` 46rem, `--measure-form` 28rem, `--measure-prose` 44rem. Tap size `--size-tap` 44px; capsule `--size-capsule` 56px (52 below 640).

### Motion

| Token | Value | Use |
|---|---|---|
| `--duration-quick` | 120ms | hover, press (button `scale(0.98)`) |
| `--duration-base` | 220ms | focus ring, input fill, notice |
| `--duration-arrive` | 640ms | hero copy and stage entrance |
| `--delay-step` | 90ms | stagger: pill, h1, lead, form; then window, popover, widget |
| `--distance-rise` | 16px (copy), 32px (stage layers) | |
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | everything |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | popover and widget settling |

- Entrance on load: copy fades and rises; the three shots rise in order and the popover and widget settle with the spring.
- Scroll reveal is CSS only, inside `@supports (animation-timeline: view())`: benefit cards and terminal lines fade in as they enter. No `IntersectionObserver`, no script.
- **Reduced motion and fallback:** every animation is declared inside `@media (prefers-reduced-motion: no-preference)` and animates *from* a hidden state, so with reduced motion, no support or no CSS animation the page is fully visible and still. Under reduce, only colour and opacity transitions at `--duration-quick` remain.

## 4. Copy (`landing-copy.ts`, `LANDING_COPY`)

| id | Text |
|---|---|
| `meta.title` | todz: your tasks, shared with your agents |
| `meta.description` | A native Mac to-do list that Claude Code, Codex and Cursor work over MCP. Menu bar, widgets, offline sync. |
| `shell.skipLink` | Skip to content |
| `shell.homeLabel` | todz home |
| `shell.wordmark` | todz |
| `shell.navLabel` | Site |
| `shell.selfHostLink` | Self-host guide |
| `shell.selfHostLinkShort` | Self-host |
| `shell.githubLabel` | todz on GitHub |
| `shell.footerSelfHost` | Self-host guide |
| `shell.footerGithub` | GitHub |
| `shell.copyright` | © todz |
| `hero.eyebrow` | macOS · Coming soon |
| `hero.title` | Your tasks, shared with your agents. |
| `hero.lead` | A native Mac to-do list that Claude Code, Codex and Cursor work over MCP. |
| `stage.label` | The todz app on a Mac desktop |
| `stage.menuCount` | 2 |
| `join.emailLabel` | Email address |
| `join.emailPlaceholder` | you@example.com |
| `join.submit` | Join the waitlist |
| `join.submitting` | Joining… |
| `join.note` | Only to tell you when todz opens. |
| `join.opensSoon` | The waitlist opens soon. |
| `benefits.heading` | Why todz (visually hidden `h2`) |
| `benefits.agents.title` | Agents add tasks over MCP |
| `benefits.agents.body` | Claude Code, Codex and Cursor read, add and finish tasks with one key per project. Every change says who made it. |
| `benefits.glance.title` | Your menu bar and widgets |
| `benefits.glance.body` | Today is one click away, and widgets check tasks off without opening the app. |
| `benefits.offline.title` | Works offline, syncs everywhere |
| `benefits.offline.body` | Changes wait while you are offline and land on every Mac when you are back. |
| `howItWorks.eyebrow` | How it works |
| `howItWorks.title` | Connect once. Ask in plain words. |
| `howItWorks.step1` | Add the server: one command, one key per project. |
| `howItWorks.step2` | Ask your agent to add, list or finish a task. |
| `howItWorks.step3` | It shows up in your menu bar and widgets. |
| `terminal.label` | Adding todz to Claude Code, then adding a task |
| `terminal.shellPrompt` | $ |
| `terminal.command` | claude mcp add --transport http todz 'https://api.todz.app/mcp' --header 'Authorization: Bearer <key>' |
| `terminal.askPrompt` | > |
| `terminal.ask` | Add a todz task: review the PR |
| `terminal.toolCall` | todz - add (MCP)(tasks: [{"title": "Review PR"}]) |
| `terminal.toolResult` | Added T-12 Review PR |
| `final.title` | Be first on the list. |
| `final.body` | Join the waitlist and get todz when it opens. |
| `selfHost.title` | Self-host todz · todz |
| `selfHost.description` | Run your own todz server on Cloudflare: fork, deploy, point the app and your agents at it. |
| `selfHost.eyebrow` | Guide |
| `selfHost.backToTop` | Back to top |
| `alt.window` | The todz main window: a project's tasks, one added via Claude Code, with its notes and history in the inspector |
| `alt.windowDark` | The todz main window in dark mode: three tasks added via Claude Code |
| `alt.popover` | The todz menu bar popover: today's tasks and an Add a task field |
| `alt.widgetMedium` | The medium Today widget with three open tasks |
| `alt.widgetRing` | The Today widget: 2 of 7 done |
| `alt.agentTasks` | A project's tasks in todz, the newest added via Claude Code |

`terminal.toolResult` follows `MCP_COPY.added` + `taskLine` ("Added T-12 Review PR"); the builder composes it from `MCP_COPY.added` so the page cannot drift from the server. The decorative glyphs `⏺` and `⎿` and the title-bar dots are markup, `aria-hidden`. The GitHub URL and `/self-host` path are constants, not copy.

## 5. Screenshots

Served from `apps/api/public/landing/` under the same relative path as in `docs/screenshots/` (`/landing/mac-app-shell/04-inspector-notes-and-history.png`), so the byte-identity test maps one to one. Files are never cropped or resized; crops are CSS (a clipping frame over the full image). `width`/`height` attributes carry each PNG's intrinsic size; the hero window gets `fetchpriority="high"`, everything else `loading="lazy" decoding="async"`.

| Use | Source | Crop box in source pixels | Display |
|---|---|---|---|
| Hero window (light) | `mac-app-shell/04-inspector-notes-and-history.png` | full, `--radius-shot` clips the corners | 66% of stage (~760px) at 1280; hidden below 640 |
| Hero window (dark, option D-B) | `v1-walk/01-agent-tasks-in-a-project.png` | full | same frame, swapped by `<picture><source media="(prefers-color-scheme: dark)">` |
| Hero popover | `menu-bar/01-today-popover.png` | full | 27% of stage (~310px) at 1280; 280px at 375 |
| Hero widget | `widgets/03-medium-today.png` | the card down to its last row: x 96–824, y 96–352 | 28% of stage (~320px); 240px at 375; `--radius-widget` |
| Benefit "agents" | `mac-sync/01-agent-add-live.png` | the list: x 322–1160, y 150–514 (Add a task and T-1…T-4, T-4 selected, "via Claude Code") | fills the 160px well, top-aligned |
| Benefit "glance" | `widgets/01-today-ring.png` | the card: x 96–436, y 96–436 | 132px square, centred in the well |
| Benefit "offline" | none: an inline glyph (a cloud holding the brand check, cobalt on glass) | — | 64px, centred in the well |

Not used: `mac-app-shell/03`, `connect-an-agent/01` (its command shows `localhost`), `menu-bar-count/01` (a dark menu bar slice; the stage draws its own strip), `widgets/02` and `04`, both mails. Six files are copied (five with option D-A).

## 6. Form states

| State | Looks | Announces |
|---|---|---|
| Idle | glass capsule; placeholder muted; button with `--gradient-action` | label "Email address", button "Join the waitlist" |
| Hover | button brightens 6% (`filter: brightness(1.06)`), capsule edge strengthens | — |
| Focus | 3px `--color-focus` ring, 2px offset, on the capsule (`:focus-within`) for the input and on the button for the button | — |
| Invalid (browser) | native `required` + `type=email` validation; `:user-invalid` draws the ring in `--color-text-muted` dashed, no red | the browser's message |
| Submitting | the inline script sets `aria-disabled="true"`, swaps the label to "Joining…" and ignores a second submit; with no script the browser simply posts | "Joining…" |
| Opens soon (the `/join` answer) | the page re-renders; both forms stay usable and empty (the address is never echoed back); under each form a notice row replaces the note: mint dot + "The waitlist opens soon." in `--color-text`, fading in at `--duration-base` | the script focuses the notice of the form whose fragment is the URL's (`tabindex="-1"`, `role="status"`), so it is read once |

There is no error state in this feature: `/join` always answers the notice (spec). The `landing-waitlist` feature adds success and failure rows in the same slot.

## 7. /self-host

```
1280                                                      375
┌ same header ───────────────────────────────────────┐    ┌ same header ─────────────┐
│  ( Guide )                                          │    │ ( Guide )                │
│  Self-host todz            h1 --text-section        │    │ Self-host todz           │
│  ───────────────────────── 44rem prose column, ─────│    │ prose, 16px side padding │
│  ## What you need          centred, page bg,        │    │ code blocks: full bleed  │
│  paragraph 17px / 1.65     aurora at the top        │    │ minus 16, scroll inside  │
│  ╭ code block #0E1020, r 12, padding 16 20 ───────╮ │    │                          │
│  │ pnpm install …                                 │ │    │                          │
│  ╰────────────────────────────────────────────────╯ │    │                          │
│  ## 1. Fork, install and check …                    │    │                          │
│                       Back to top ↑                 │    │                          │
├ same footer ────────────────────────────────────────┤    ├ same footer ─────────────┤
```

- No sidebar or table of contents: ten short sections read top to bottom. The generator gives each `h2` an `id` from its text so a step can be linked.
- Prose: body 1.0625rem / 1.65; `h2` `--text-title`, `--space-7` above, hairline above from the second on; lists 1.5rem indent; links `--color-link`, underlined with 0.12em offset; tables (if any) hairline rows, header muted 600.
- Code blocks: `--color-terminal` in both schemes, `--color-terminal-text`, `--font-mono` `--text-code`, `--radius-control`, `overflow-x: auto`, `tabindex="0"`, `role="region"` and an `aria-label` of "Code" so keyboard users can scroll. Inline code: `rgb(47 91 255 / 0.08)` chip (`/ 0.16` in dark), radius 6px, 0.9em.
- No glass on the article (reading first); the header and footer keep theirs.

## 8. Accessibility

- Landmarks: `header` (with `nav aria-label="Site"`), `main id="content"`, `footer`. One `h1`; `h2` for benefits (visually hidden), how it works and the final call; `h3` for each benefit.
- Focus order: skip link, logo, self-host, GitHub, email, join, (the rest of the page has no controls) final email, final join, footer links. Every control ≥ 44px tall.
- Forms: each input has its own `label` (visually hidden), `autocomplete="email"`, `inputmode="email"`, `required`; ids differ between the two forms.
- Images: each shot has the alt from section 4. The menu strip and the glyphs are `aria-hidden`. The stage is a `figure` with `stage.label` as its visually hidden `figcaption`.
- Terminal: real text in `pre`, read in order; prompts `$` and `>` are text, `⏺`/`⎿` are hidden.
- Contrast (WCAG AA), measured on the opaque fallback, which is the worst case for the glass:

| Pair | Light | Dark |
|---|---|---|
| text on page / surface | `#161A33` on `#F2F4FA` 15.6:1 | `#F2F4FF` on `#070812` 18.2:1 |
| muted on page | `#5B6285` on `#F2F4FA` 5.4:1 | `#A9B0D6` on `#070812` 9.4:1 |
| muted on glass (light: lightest wallpaper spot `#F4E3F1` under 62% white; dark: the `#171A2E` fallback) | 5.5:1 | 8.1:1 |
| accent text | `#2F5BFF` on `#F2F4FA` 4.7:1 | `#7C95FF` on `#070812` 7.2:1 |
| link | `#2F5BFF` 4.7:1 | `#8CF7D0` on `#070812` 15.5:1 |
| button label | `#FFFFFF` on `#2F5BFF` (lightest end) 5.2:1 | same |
| terminal muted / text | `#9AA3C7` 7.6:1, `#E6E9F7` 15.6:1 on `#0E1020` | same |
| focus ring vs page (3:1 non-text) | 4.7:1 | 15.5:1 |

- Motion: section 3. Transparency: section 3 (glass fallback). `forced-colors`: borders stay, the action button keeps `ButtonText`/`ButtonFace`.
- `html lang="en"`, `color-scheme: light dark`, `meta name="theme-color"` per scheme (`#F2F4FA`, `#070812`).

## 9. Options (the loop picks; recommendation marked ✅)

**H. Hero layout**

| | Option | Trade-off |
|---|---|---|
| ✅ H-A | Centred copy and form, the desk stage full width below it, its top third above the fold | Apple-like and cinematic; the window shows at ~760px, legible; the promise is short enough to own the centre. The stage is mostly a scroll away at 800px tall |
| H-B | Split: copy and form left (5 columns), stage right (7 columns) | Everything in the first screen; the window shrinks to ~560px and its text becomes texture; closer to zapbip's hero, which the owner wants shorter, not the same |

**G. Glass intensity**

| | Option | Trade-off |
|---|---|---|
| ✅ G-A Quiet glass | wallpaper only in the stage and the final call; the page is `--color-page` with the aurora; header, pill, capsule and cards are glass | the screenshots carry the colour; text stays on calm ground; blur has something to refract where it matters |
| G-B Full wallpaper | the wallpaper gradient behind the whole page, every block glass | the most "Liquid Glass"; muted text drops toward 4.6:1 on the pink spots and the shots compete with the background |
| G-C Flat | opaque cards, no blur | cheapest to render, AA by construction; loses the family resemblance with the app |

**D. Dark scheme hero shot**

| | Option | Trade-off |
|---|---|---|
| ✅ D-B | `<picture>` swaps the window for `v1-walk/01` (dark) in dark mode; popover and widget stay as shot | no white slab on a dark page, and the dark shot shows "via Claude Code" on every row; the popover and widget are light, as they would be beside a dark window only if the user mixes appearances |
| D-A | the same light shots in both schemes | one coherent set; a bright 760px window dominates the dark page |

**F. Final call**

| | Option | Trade-off |
|---|---|---|
| ✅ F-A | a second `join-form` | one step to join from the bottom; the `#final` fragment returns the reader there with the notice |
| F-B | a button linking to `#join` | one form only; a scroll back up and a second click, and the link does not focus the input without script |

**Not offered, decided:** no copy button on the command (the key placeholder must be replaced anyway, and the app has its own Copy); no table of contents on /self-host.

## 10. Notes for the plan

- The inline script is the only script: the submit guard and the notice focus, about ten lines, hashed like `sign-in-page.ts`'s.
- The CSP has no `style-src 'unsafe-inline'`, so no `style=""` attribute anywhere: crop offsets, stage positions and delays are classes in the one hashed `<style>`.
- The GitHub link points at the repository; if it is still private when the site goes live, the link answers 404 for strangers. That is a publish-time check for the owner, not a design change.
- Media for the PR: the recorder shoots 1280 and 375 in both schemes, with and without reduced motion, plus the "opens soon" answer from each form.

## Owner decisions

The owner delegated every call to the build loop (2026-11-24, "take every decision and do not stop, I review later"). These are the loop's picks, listed in STATE.md for him to overturn:

- H-A, G-A, D-B and F-A: the recommended options, as written above.
- The GitHub links in the header and the footer are left out while the repository is private, because they would answer 404 to strangers. `shell.githubLabel` and `shell.footerGithub` stay in `LANDING_COPY`, unused, and the links return in the change that makes the repository public.
