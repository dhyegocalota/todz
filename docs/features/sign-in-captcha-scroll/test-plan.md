# Test plan: Sign-in captcha scroll

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [x] `apps/api/test/sign-in-challenge-page.test.ts::the style` — input: `GET /sign-in/challenge`; expected: the inline style hides the overflow of `html` and `body` — evidence: red at 0717a9a in a throwaway worktree: 1 failed | 11 passed, `AssertionError: expected ':root{color-scheme:light dark}\nbody{…' to contain 'html,body{margin:0;overflow:hidden;ba…'` (matches the briefing); green at 210574b: 12 passed
- [x] `ChallengeHeightTests` — input: a reported height; expected: the clamped height — evidence: red at f252703 in a throwaway worktree: 11 issues in 4 tests, `ChallengeHeight.clamped(reported: reported) == 65` (-inf, nan, ...), `== 500` (500.1, ...), `script.contains(...)` x3 with `script → ""` (matches the briefing); green at 210574b: 4 tests in 1 suite passed
- [x] Confirmed both fail for the right reason: the recorded failure text names the missing `overflow:hidden` and the unimplemented `ChallengeHeight`, not a broken test — evidence: both worktrees removed after the runs; the failures are assertion mismatches against the stub, not compile or import errors

## Unit

- [x] Style carries `html,body{margin:0;overflow:hidden;background:transparent}` and the policy's `style-src` hash matches it — evidence: served `GET /sign-in/challenge` from `wrangler dev`: style contains the rule; sha256 of the served `<style>` text = `2lw1U0IbDmCpuVFFv1CoETZkor6VDRkBxyldiY1NSXY=` equals the served CSP `style-src` hash; script hash `6p5l1GotMJtny50bEw0aYg04IoVug8dy8zaVwJ45uPs=` equals `script-src`
- [x] `ChallengeHeight.clamped`: 0 and negative give 65; NaN and infinity give 65; 65 gives 65; 120 gives 120; 9999 gives the maximum — evidence: `swift test --filter ChallengeHeightTests` at 210574b, the three clamp tests pass (5 + 4 + 3 cases, from the red run's case counts); `pnpm typecheck` clean
- [x] The script posts to the height handler and reads the `.cf-turnstile` element — evidence: `theScriptReportsTheWidgetHeightToTheHeightHandler` passes at 210574b; at runtime the grown view (below) proves the script reached the app

## Prove it for real (macOS app, signed out, scratch data container, the sign-in window only)

Setup: Debug builds of `origin/main` (before) and 210574b (after) with scratch bundle identifiers `dev.todz.scratch.before` / `dev.todz.scratch.after`, app group and API base URL overridden on the `xcodebuild` command line (the owner's `dev.todz.Todz.debug` and `/Applications/Todz.app` untouched), against `wrangler dev` on 8798 / 8799 with Turnstile test site key `1x00000000000000000000AA` (dummy widget, always passes; it carries its own red "For testing only" banner). The system is in dark appearance; the app's light appearance came from `NSRequiresAquaSystemAppearance` on the scratch bundle only.

- [x] Light appearance: the widget shows at 300×65, centered, no scroll bar, wheel over it does not scroll — evidence: `.pr-media/sign-in-captcha-scroll/after-light.png`; widget is 65 points high and spans the form column, which is 280 points wide, so it measures 280×65, not 300×65 (see Edge cases); `orca computer scroll` down 3 pages over the web view left the window capture byte-identical (`cmp`); no scroll bar element in the tree
- [x] Dark appearance: same, background transparent over the window — evidence: `.pr-media/sign-in-captcha-scroll/after-dark.png`; no scroll bar, widget flush with the form column, window background shows around it. The dummy widget's "Success!" label and check are invisible in dark in the BEFORE build too (`before-dark.png`), so not caused by the fix
- [x] Managed non-interactive: the view is 65 high — evidence: `after-light.png` and `after-dark.png`: widget region 130 px on a 2x capture
- [x] An interactive challenge that grows: the view grows to the reported height, nothing scrolls — evidence: Turnstile test keys cannot produce a taller widget (`3x00000000000000000000FF` showed only a 65 high checkbox that solved on click: `after-interactive-before-click.png`, `after-interactive-clicked.png`). Simulated with a scratch worktree copy of 210574b whose page style adds `.cf-turnstile{min-height:200px}` (CSP hash recomputed from the style, so the page still loads): the view grew from 65 to 200 points, no scroll bar in the tree, `after-grown-200.png`. The copy was deleted; no product code changed
- [x] Window resize: the widget stays centered, no scroll bar appears — evidence: window dragged from 1100×700 to 760×562, widget stays centered on the form, tree has no scroll bar, `after-light-resized.png`
- [ ] VoiceOver / accessibility tree: no `scroll area` and no `scroll bar` inside the web view — FAIL on the literal wording, PASS on the intent: after the fix the tree has no `scroll bar` (before: one `scroll bar 0` under the Security check container, plus the visible bar in `before-dark.png`), but two `scroll area` nodes remain (the WKWebView's own and the Turnstile iframe's), before and after. Their scrollers are hidden and the wheel is inert. Owner decision: accept `scroll area` containers or have the developer hide them from accessibility
- [x] After a send, the round reloads the page and the view returns to 65 before the next report — evidence: view grown to 200 (scratch page), Send Link clicked, the round reloaded and the view stayed 200 until the next page reported; I swapped the served page to the real 65 high one and clicked Send Link again: the view returned to 65 (`after-round-two-65.png`). Note the view keeps its old height until the new page reports (see Edge cases)
- [x] Old page (API not yet deployed): the app still shows no scroll bar — evidence: new app against `wrangler dev` of `origin/main` (no overflow rule in the served page): tree has no scroll bar, `after-old-page.png`

## Edge cases found during execution

- The widget measures 280 wide in a 1100 and in a 760 point window, not 300: the form column is 280 points and the dummy widget shrank to it with both borders visible, so nothing is clipped. Outcome: the 300 in the plan and spec is the widget's nominal width; the view spans the form column. Not a defect, state it in the PR.
- When the widget is shorter than the view (200 point view after reload, before the new height arrives), a darker rectangle shows under the widget: the web view's own backdrop, not the transparent page. Outcome: visible only in the transient between a reload and the next height report (`after-grown-after-send.png`); with a real 65 high widget the view is flush. Minor.
- The challenge view's height state lives in `ChallengeView`, which survives the round's reload (`.id(model.challengeRound)` is on the web view only), so the view keeps the previous height until the new page reports. Outcome: harmless when the new report arrives, which it did.
- The dummy test widget's "Success!" label and check are invisible in dark appearance in both builds; a property of the test widget, not of this change.
- The dummy widget's "For testing only" banner overlays the widget's lower part in both builds; not seen with a real key (cannot be checked locally).
- Page Down in the focused email field changed the window capture only by the field's focus ring (`cmp` differs; visual diff shows the focus ring and nothing scrolled).

## Adversarial review

- [x] Claim 1: no scroller is visible in any state — attack: grow, resize, wheel, trackpad, keyboard Page Down; result: held. Grown to 200, resized to 760×562, wheel scroll (3 pages) over the web view, Page Down: no scroll bar visible in any capture and none in the tree. Trackpad gestures cannot be generated through Orca; the wheel scroll through the accessibility layer was the nearest, and the app's `scrollWheel` override forwards to the responder chain by reading
- [ ] Claim 2: a message from another frame cannot set the height — attack: post from the Turnstile iframe; result: BLOCKED: the iframe is cross-origin (`challenges.cloudflare.com`) and a WKWebView in the app cannot be scripted from outside; the only evidence is reading: the user script is `forMainFrameOnly: true` and the coordinator drops any message whose frame is not the main frame of the API origin (`ChallengeNavigation.isTrustedMessage`, covered by existing unit tests)
- [x] Claim 3: the page policy still matches the style — attack: compare the served hash to the served style; result: held. sha256 of the served `<style>` = served CSP `style-src` hash, and sha256 of the served `<script>` = `script-src` hash, from `wrangler dev` at 210574b; the same also held for the scratch page with the extra rule, which loaded and rendered

## Coverage honesty

- The subclass that hides the scrollers is WebKit view code with no unit test; the tester's accessibility-tree check is its proof.
