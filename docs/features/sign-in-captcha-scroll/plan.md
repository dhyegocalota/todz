# Plan: Sign-in captcha scroll

**Spec:** spec.md
**Tier:** 🟡
**Seam:** `PAGE_STYLE` in `apps/api/src/sign-in-challenge-page.ts` and `ChallengeView` in `apps/macos/Todz/SignIn/ChallengeView.swift`
**Assumptions (decided, owner can override):**
- The page script stays untouched; the app measures the widget with its own user script, so the page's hashed script and its tests do not move.
- The maximum height is 500 points, enough for an interactive challenge.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/src/sign-in-challenge-page.ts`, `apps/api/test/sign-in-challenge-page.test.ts` | `developer` |
| G2 | `apps/macos/TodzKit/Sources/TodzKit/ChallengeHeight.swift`, `apps/macos/TodzKit/Tests/TodzKitTests/ChallengeHeightTests.swift`, `apps/macos/Todz/SignIn/ChallengeView.swift` | `developer` |
| G3 | `docs/features/sign-in-captcha-scroll/`, `docs/features/README.md` | `developer` |

## Sequencing

G3 docs first, then G1 and G2 each red then green, then the briefing.

## Steps

### G1

- [x] **Step 1:** Red: the style test in `sign-in-challenge-page.test.ts`, committed alone (0717a9a).
- [x] **Step 2:** Green: `PAGE_STYLE` hides the overflow and centers the widget (d61065e).

### G2

- [x] **Step 3:** Red: `ChallengeHeightTests` with a stub `ChallengeHeight`, committed alone (f252703).
- [x] **Step 4:** Green: `ChallengeHeight` clamp and script; `ChallengeView` follows the reported height, hides the scrollers and passes scroll events up (f8b1f24).

### G3

- [x] **Step 5:** Tester briefing (`tester-briefing.md`).

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | The new style changes its hash and the policy no longer matches | the policy test in `sign-in-challenge-page.test.ts` fails | fix the hash source; the policy derives it from the same string |
| 2 | Not deployed: the old page still has no `overflow:hidden` | the app's scrollers are still hidden by step 4, the page itself still can scroll | deploy the API |
| 4 | The script cannot find the widget (unavailable page) | no height message; the view stays at 65 | none needed |
| 4 | The reported height is huge or zero | `ChallengeHeightTests` | the clamp |
| 4 | WebKit re-adds the scrollers on layout | a scroll bar is visible in the sign-in window | the subclass hides them on each layout |

**Steps with no backout:** none (revert the commits; the deploy reverts the page)

## Z. Prove and ship

- [x] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
