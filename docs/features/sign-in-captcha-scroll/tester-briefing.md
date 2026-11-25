# Tester briefing: Sign-in captcha scroll

Written by the developer. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/api/src/sign-in-challenge-page.ts`: the page style hides the overflow of `html` and `body` and centers the widget. The page is served by the Worker, so the API must be deployed for the page to change in production.
- `apps/macos/TodzKit/Sources/TodzKit/ChallengeHeight.swift`: the 65 to 500 clamp, the height handler name and the user script that observes `.cf-turnstile` and posts its height.
- `apps/macos/Todz/SignIn/ChallengeView.swift`: the view height follows the reported height; `FixedWebView` hides every `NSScrollView` scroller on layout and passes scroll wheel events up the responder chain; the user script and the second handler are registered and removed.

## How to run

```bash
pnpm --filter @todz/api exec vitest run test/sign-in-challenge-page.test.ts
swift test --package-path apps/macos/TodzKit --filter ChallengeHeightTests
cd apps/macos && xcodegen generate && xcodebuild -scheme Todz -configuration Debug build
```

To see the screen without disturbing the owner: launch the Debug build signed out against a scratch data container (a throwaway `HOME` or the app's sandbox container path for the Debug bundle, never the owner's), with the API on a local `wrangler dev` so the page carries the new style. Find the window with `orca computer list-apps` or `CGWindowListCopyWindowInfo`, capture only it with `screencapture -l <windowid> out.png`, and read the accessibility tree of that window with `orca computer get-app-state` (expect no `scroll area` or `scroll bar` under the web view). Toggle appearance in the scratch run only.

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `sign-in-challenge-page.test.ts > hides the overflow of the page, keeps it transparent and centers the widget` (0717a9a) | `AssertionError: expected ':root{color-scheme:light dark}\nbody{…' to contain 'html,body{margin:0;overflow:hidden;ba…'` | `PAGE_STYLE` carries the rules |
| `ChallengeHeightTests` (f252703) | `Expectation failed: ChallengeHeight.clamped(reported: reported) == 65` (0.0, -10.0, 64.9, nan, -inf); `== 500` (500.1, 9999.0, inf); `script.contains("window.webkit.messageHandlers.\(ChallengeHeight.handlerName).postMessage")`, `.cf-turnstile` and `ResizeObserver` not found; 11 issues in 4 tests | the clamp and the script are implemented |

## Hypotheses to attack

1. Hypothesis: no scroll area or scroll bar is in the web view's accessibility tree, in light and dark. Break it by: reading the tree, scrolling with the wheel and trackpad, pressing Page Down over the view.
2. Hypothesis: an interactive challenge grows the view to the widget's height and nothing scrolls. Break it by: forcing an interactive challenge (a Turnstile test site key for "forces an interactive challenge") on a scratch API.
3. Hypothesis: only the main frame of the API origin can set the height. Break it by: posting to `turnstileHeight` from the Turnstile iframe.
4. Hypothesis: the served style hash still matches the served style. Break it by: comparing the `style-src` hash with the served `<style>`.
5. Hypothesis: with the old deployed page the app still shows no scroll bar. Break it by: pointing the Debug build at production before the deploy.
6. Hypothesis: the view returns to 65 for the next round after a send. Break it by: sending a link and watching the view during the reload.

## Known gaps

- `FixedWebView` and the height binding are WebKit and SwiftUI view code with no unit test; the accessibility-tree check is their proof.
- The 500 point maximum is a guess for an interactive challenge; the tester reports the tallest widget seen.
- The widget's centering is by the page (flex); the view itself spans the form's width.
- Not launched on screen by the developer, by the owner's instruction.
