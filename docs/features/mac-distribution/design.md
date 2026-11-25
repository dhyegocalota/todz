# Design: mac-distribution

**Sources:** [the spec](spec.md), [ADR 0072](../../adr/0072-the-mac-app-downloads-from-todz-app-as-a-development-signed-dmg-with-an-ssh-signature-and-updates-through-sparkle.md), [the landing design](../landing/design.md) (the hero, the capsule, the note), [the waitlist-inline design](../waitlist-inline/design.md) (the hero form as it ships), and the current code: `heroHtml` in `landing-page.ts`, `LANDING_COPY.hero`, `SITE_STYLE`.
**Design system:** unchanged. The button reuses the action look of `.join-button` (`--gradient-action`, `--shadow-action`, `--color-on-action`, `--size-capsule`, `--radius-pill`); the line reuses the note's type (`--text-small`, `--color-text-muted`). No token is added.

## 1. Layout

The hero copy column gains one block between the lead and the waitlist form:

```
[ eyebrow pill: macOS 14 or later ]
Your tasks, shared with your agents.
A native Mac to-do list that Claude Code, Codex and Cursor work over MCP.

[ Download for Mac ]                                      .download-button, an <a>
Not notarized by Apple yet: the first time, open it from   .download-note
System Settings › Privacy & Security. Install steps         "Install steps" links the docs page

[ waitlist form, unchanged ]
```

- `.download` is a block centred like the form, `max-width: var(--measure-form)`, with `margin-top: var(--space-6)` (the spacing the hero form uses today); the waitlist form below keeps its own `margin-top`.
- `.download-button` is an `<a href="/download">` with the action look, `display: inline-flex`, `height: var(--size-capsule)`, `padding: 0 var(--space-6)`, text only: `site-glyphs.ts` has no download glyph and none is drawn. It carries the `download` attribute so a browser saves rather than navigates.
- `.download-note` sits under the button with `margin-top: var(--space-3)`, centred, wrapping freely; "Install steps" is an underlined link (`--color-text`, underline offset as the footer links) to `https://docs.todz.app/install-on-mac`.
- 1280 px: the button is its natural width (about 200 px), the note two lines at most inside the form's measure.
- 375 px: the button grows to the full width of the column (`width: 100%`), the note wraps to three lines; no horizontal scroll, no overlap with the stage figure below.

## 2. States

| State | What shows |
|---|---|
| Default | button and note as above |
| Hover | `filter: brightness(1.06)`, as the join button |
| Active | `transform: scale(0.98)`, as the join button |
| Focus (keyboard) | `outline: 3px solid var(--color-focus); outline-offset: 2px` |
| `prefers-reduced-motion` | the hero's `rise` animation is skipped as for the rest of the hero; no transform on press |
| `prefers-reduced-transparency` / `forced-colors` | the button falls back as `.join-button` does (`ButtonFace`, `ButtonText`, a 1 px border) |
| No release published yet | not a state of the page: the button's `/download` answers `404` only for the minutes between the first deploy and the first release, which the `deploy` skill runs back to back |

## 3. Light and dark

Both schemes use the same tokens; the action gradient and `--color-on-action` already have dark values in `SITE_STYLE`'s `prefers-color-scheme: dark` block, and the note's muted text has its dark value there. Screenshots for the PR: 1280 and 375, light and dark.

## 4. Copy (in `LANDING_COPY`)

| Key | Text |
|---|---|
| `hero.eyebrow` | `macOS 14 or later` |
| `download.button` | `Download for Mac` |
| `download.note` | `Not notarized by Apple yet: the first time, open it from System Settings › Privacy & Security.` |
| `download.noteLink` | `Install steps` |

`discovery-copy.ts`'s status line becomes `todz is in development: the macOS app is a download, not yet notarized by Apple, and the waitlist is open.`

## 5. The app

The app menu gains `Check for Updates…` right after `About Todz` in Release builds (Sparkle's standard action; copy in `apps/macos/Copy`). Sparkle's own window asks before an update installs. Scheduled checks use Sparkle's gentle reminders: when todz is not the app in front, a found update never opens a window over the owner's work; it waits for the next launch or for "Check for Updates…". When the owner is in todz, Sparkle's standard window may show. Debug builds show no item.

## 6. Accessibility

- The button's accessible name is its text.
- The note is plain text after the button, read in order; the link's name "Install steps" is unique on the page.
- Contrast: the button inherits the join button's measured contrast; the note inherits the join note's.
