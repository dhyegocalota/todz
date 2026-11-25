# Sign-in captcha scroll

**Status:** Shipped 2026-11-25
**Tier:** 🟡 (the Worker's challenge page changes, so the fix needs a deploy of the API)
**Owner approval:** approved 2026-11-25, relayed by todz-6f: "tira o scroll do captcha na tela de login, wtf"
**ADRs:** [0045](../../adr/0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md), [0046](../../adr/0046-the-app-solves-the-challenge-in-a-web-view-and-the-link-page-solves-it-for-the-sign-in.md)
**Not changing:** the token flow, the message handler `turnstile`, the policy's sources, the link page, the web view's navigation rules

## Problem

The sign-in screen's "Security check" web view shows a scroll area with a vertical scroll bar around the Turnstile widget (a `scroll area` and a `scroll bar` in the accessibility tree). The widget is 300×65 and the page does not hide its overflow.

## Change

- The Worker serves `GET /sign-in/challenge` with `html,body{margin:0;overflow:hidden;background:transparent}` and the widget centered; the style keeps its own hash in the policy. The Worker is deployed for it.
- The unavailable page's text is centered too, by the same body rule.
- The app injects a document-end script (inside a function, no global) that reports the widget's height to a second message handler; `ChallengeHeight` in TodzKit clamps a finite height between 65 and a maximum and ignores a non-finite one, and the view follows it, so an interactive challenge grows the view and nothing scrolls. The height resets to 65 whenever the challenge reloads.
- The widget measures 280×65, not 300×65: the form column is 280 points wide and the widget shrinks to it.
- The `scroll area` nodes WebKit keeps in the accessibility tree (the web view's and the Turnstile iframe's) remain as containers with hidden scrollers; the complaint was the visible scroll bar.
- The web view subclass hides the scrollers of its enclosing scroll view and passes scroll wheel events up the responder chain.

## Test list

- `apps/api/test/sign-in-challenge-page.test.ts`: the style hides the overflow of `html` and `body`, keeps the background transparent and centers the widget.
- `ChallengeHeightTests` (TodzKit): below the minimum and non-finite heights clamp to 65, above the maximum clamps to it, in range passes through; the script posts to the height handler.
- Debug `xcodebuild` build succeeds; the tester sees no scroll area in the sign-in window.
