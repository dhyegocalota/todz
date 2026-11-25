# Test plan: Sign-in captcha scroll

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [ ] `apps/api/test/sign-in-challenge-page.test.ts::the style` — input: `GET /sign-in/challenge`; expected: the inline style hides the overflow of `html` and `body`
- [ ] `ChallengeHeightTests` — input: a reported height; expected: the clamped height
- [ ] Confirmed both fail for the right reason: the recorded failure text names the missing `overflow:hidden` and the unimplemented `ChallengeHeight`, not a broken test

## Unit

- [ ] Style carries `html,body{margin:0;overflow:hidden;background:transparent}` and the policy's `style-src` hash matches it
- [ ] `ChallengeHeight.clamped`: 0 and negative give 65; NaN and infinity give 65; 65 gives 65; 120 gives 120; 9999 gives the maximum
- [ ] The script posts to the height handler and reads the `.cf-turnstile` element

## Prove it for real (macOS app, signed out, scratch data container, the sign-in window only)

- [ ] Light appearance: the widget shows at 300×65, centered, no scroll bar, wheel over it does not scroll
- [ ] Dark appearance: same, background transparent over the window
- [ ] Managed non-interactive: the view is 65 high
- [ ] An interactive challenge that grows: the view grows to the reported height, nothing scrolls
- [ ] Window resize: the widget stays centered, no scroll bar appears
- [ ] VoiceOver / accessibility tree: no `scroll area` and no `scroll bar` inside the web view
- [ ] After a send, the round reloads the page and the view returns to 65 before the next report
- [ ] Old page (API not yet deployed): the app still shows no scroll bar

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] Claim 1: no scroller is visible in any state — attack: grow, resize, wheel, trackpad, keyboard Page Down; result:
- [ ] Claim 2: a message from another frame cannot set the height — attack: post from the Turnstile iframe; result:
- [ ] Claim 3: the page policy still matches the style — attack: compare the served hash to the served style; result:

## Coverage honesty

- The subclass that hides the scrollers is WebKit view code with no unit test; the tester's accessibility-tree check is its proof.
