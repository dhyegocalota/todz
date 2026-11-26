# Test plan: todz.app says how proactive todz is

Every box is ticked by the tester with evidence (commit hash, log path, counts, screenshot path). The developer never ticks these.

## Unit (`apps/api/test/landing-proactive.test.ts`)

- [ ] U1. `LANDING_COPY.benefits.day.title` equals "todz doesn't wait to be opened." and `LANDING_COPY.benefits.glance` is undefined.
- [ ] U2. The day card renders the four stop times in order: `07:00`, `09:00`, `10:30`, `18:00`.
- [ ] U3. The card renders the chips for the ribbon, the temperature and Siri, each with its label.
- [ ] U4. The note reads "Each one but Siri is a switch in Settings. Respect Focus keeps your Mac quiet during a Focus." and does not contain "quiets them all".
- [ ] U5. The agent stop's tool result equals `MCP_COPY.agentNudge.line` with the example summary and task id.
- [ ] U6. The mail stop's subject matches the subject pattern in `apps/api/scripts/emails/day-email-copy.ts`, pinned in a test as equal.
- [ ] U7. The Swift-sourced copy (ribbon detail, the Done, Tomorrow and No date labels, the Siri phrase) equals `swiftCopyValue` of the matching Swift source.
- [ ] U8. The day card markup has no `style=` attribute and no `on*` attribute.
- [ ] U9. The markdown alternate has a `###` heading for the day card with the four stop lines, and no line about the glance card.
- [ ] U10. The JSON-LD `featureList` includes the morning glance, the 18:00 close, the 07:00 mail, the agent mention, the menu bar ribbon, the day temperature and Siri.
- [ ] U11. `llms.txt` has one line per proactive feature, in the same wording as the card.

## E2E (`apps/api/e2e/landing-proactive.spec.ts`)

- [ ] E1. Desktop 1280, light: the heading "todz doesn't wait to be opened." is visible inside `section.benefits`, the four stops, the chips and the note are visible.
- [ ] E2. Desktop 1280, dark: the same assertions, and the card background differs from light.
- [ ] E3. 390 px, light and dark: the same assertions; `document.documentElement.scrollWidth <= clientWidth`.
- [ ] E4. Reduced motion (`prefers-reduced-motion: reduce`): the rail track has its full width and the vignettes have no `transform`.
- [ ] E5. Default motion, Chromium: the track fill width grows between two scroll positions.
- [ ] E6. The page sends no inline handler and loads no script beyond the existing ones; no CSP violation; no console errors.
- [ ] E7. Keyboard: the focus order of existing links is unchanged; the card adds no focusable element.

## Edge cases

- [ ] X1. `stars` null: the card still renders (it does not depend on stars).
- [ ] X2. JS off: the card and the note are readable.
- [ ] X3. No `animation-timeline` support (Firefox): the track is complete, not empty.

## Screenshots (recorded before the deploy)

- [ ] S1. `.pr-media/landing-proactive/desktop-light.png`
- [ ] S2. `.pr-media/landing-proactive/desktop-dark.png`
- [ ] S3. `.pr-media/landing-proactive/mobile-light.png` (390 px)
- [ ] S4. `.pr-media/landing-proactive/mobile-dark.png` (390 px)
