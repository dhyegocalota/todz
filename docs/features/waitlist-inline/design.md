# Design: waitlist-inline

**Sources:** [the spec](spec.md), [ADR 0067](../../adr/0067-the-waitlist-joins-in-place-over-fetch-behind-a-visible-check-a-honeypot-and-a-signed-render-time.md), [the landing design](../landing/design.md) (the glass card, the capsule, the note), and the current code: `joinFormHtml` and `PAGE_SCRIPT` in `landing-page.ts`, `LANDING_COPY.join`, `SITE_STYLE`.
**Design system:** unchanged. The landing's glass tokens, type scale and accent; no token is added. The only new rules are the widget's frame and the off-screen honeypot.

## 1. Layout

Each form (hero and final) keeps its order and gains one row:

```
[ email capsule: input | Join the waitlist ]
[ Turnstile widget, flexible width = capsule width, 65 px tall ]
[ status line: dot + text ]          role="status"
```

- The widget sits in `.join-check`, a frame with the capsule's corner radius and the card's inner spacing above and below (the spacing the note uses today), `min-height: 65px` so the iframe fills reserved space and the first fold does not shift, no border or shadow of its own: the Turnstile iframe draws its own light or dark surface, and `data-theme="auto"` follows the visitor's scheme, so the card's glass shows around it in both.
- At 375 px the capsule wraps as today and the widget takes the full form width (at least 300 px: below the narrow breakpoint the final-call card uses `padding-inline: var(--space-4)`, so the form is 311 px at 375 px; 320 px is out of scope); no horizontal scroll.
- The honeypot (`todz_fax`, with the password-manager opt-outs) sits in `.join-extra`, off screen (`position: absolute`, `width: 1px`, `height: 1px`, `overflow: hidden`, `clip-path: inset(50%)`, `white-space: nowrap`), so it takes no space and no focus.

## 2. States

The status line is the one live region per form; the button label changes only while sending.

| State | `data-join-state` | Button | Status line |
|---|---|---|---|
| Page loaded, no token yet | `waiting` | "Join the waitlist", `aria-disabled="true"`, dimmed as the existing disabled style | the note "Only to tell you when todz opens." |
| Press while waiting | `waiting` | unchanged | "Finish the check below to join." |
| Token arrived | `ready` | enabled | unchanged |
| Sending (including the 3 s hold) | `sending` | "Joining…", `aria-disabled="true"` | unchanged |
| `joined` | `waiting` until the next token | label restored | "You're on the list. Check your inbox." (field cleared) |
| `invalid` | `waiting` | label restored | "That address doesn't look right." |
| `check-failed` | `waiting` | label restored | "The check didn't pass. Try it again." |
| `try-again` | `waiting` until the token and `Retry-After` have both passed | label restored, `aria-disabled` | "Couldn't add you right now. Try again in a minute." |
| `opens-soon` | `waiting` | label restored | "The waitlist opens soon." |
| Fetch failed or a non-JSON answer | `waiting` | label restored | "Couldn't reach todz. Check your connection and try again." |
| Turnstile never loaded, or errored | `waiting` | `aria-disabled` | "The check couldn't load. Reload the page to try again." |
| Token expired | `waiting` (the widget refreshes itself; the separate expiry callback recomputes each form from its own token) | `aria-disabled` | unchanged |
| No widget on the page (no key or secret) | `ready` at once | enabled, no `aria-disabled` in the markup | the post answers `opens-soon` |

Answer lines carry the existing `notice-dot` before the text, as the HTML notices do. Focus never moves; the polite region announces the line.

## 3. Copy

New keys in `LANDING_COPY.join`, English, short, no exclamation marks, matching the existing lines:

| Key | Text |
|---|---|
| `waitingForCheck` | Finish the check below to join. |
| `invalid` | That address doesn't look right. |
| `checkFailed` | The check didn't pass. Try it again. |
| `unreachable` | Couldn't reach todz. Check your connection and try again. |
| `checkError` | The check couldn't load. Reload the page to try again. |
| `honeypotLabel` | Leave this field empty |

Existing keys reused: `note`, `submit`, `submitting`, `joined`, `tryAgain`, `opensSoon`.

`WEBMCP_COPY.answers`: `sent` goes; `joined` "The address is on the waitlist; a confirmation mail is on its way if it is new.", `invalid` (kept), `checkFailed` "The page's human check did not pass. Ask the person to complete it, then call again.", `tryAgain` "The waitlist refused for now. Try again in a minute.", `opensSoon` "The waitlist is not open yet.", `unreachable` "The page could not reach todz.", `checkTimedOut` "The page is still waiting for the person to complete its human check. Ask them to complete it, then call again.", `alreadySubmitting` (kept). The tool's description loses "may ask … before it sends" and says it waits for the page's human check and answers with the result.

## 4. Light, dark, phone

- Light: the white Turnstile surface on the light glass card; the status dot in the accent.
- Dark: Turnstile's dark surface on the dark glass card (`data-theme="auto"`); no light flash, since the theme is chosen before the iframe paints.
- 375 px: capsule, widget and status line stacked at full form width; the tester compares screenshots at 1280 and 375 in both schemes with the ones taken before the change.
- Reduced motion: nothing new animates.

## 5. Accessibility

- The widget's iframe is labelled by Cloudflare; the frame adds nothing focusable.
- `aria-disabled` keeps the button in the tab order; a press says why in the status line.
- The honeypot's wrapper is `aria-hidden="true"` and its input `tabindex="-1"`, so axe's `aria-hidden-focus` holds and Lighthouse Accessibility stays at 100.
- Tab order per form: email → button → the widget's checkbox (when Turnstile shows one).
