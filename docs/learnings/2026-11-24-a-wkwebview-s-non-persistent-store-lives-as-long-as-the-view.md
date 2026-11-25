# A web view that is "non-persistent" still keeps its cookies across reloads

- Date: 2026-11-24
- Inspired by: `sign-in-guard`'s tester pass at 8db0dd9, [ADR 0046](../adr/0046-the-app-solves-the-challenge-in-a-web-view-and-the-link-page-solves-it-for-the-sign-in.md) §3, fix d3396c9

## Signal

`WKWebsiteDataStore.nonPersistent()` is set, so the code reads as "keeps no website data", but cookies, local storage and the challenge's own state survive every reload of the page in the same web view. Nothing fails; a review against "no data between rounds" finds it by reading the code.

## Cause

A non-persistent store keeps nothing on disk, but it lives in memory as long as the configuration that holds it. A `WKWebView` built once in `makeNSView` and told to `load` again on each round keeps the same store, so every round shares it until SwiftUI dismantles the view.

## Do

When each round must start clean, build a new `WKWebView` with a new `.nonPersistent()` store per round: key the `NSViewRepresentable` with `.id(round)` so SwiftUI dismantles and rebuilds it, and keep `updateNSView` free of reload bookkeeping.

## Anchor

`apps/macos/Todz/SignIn/ChallengeView.swift`; commit d3396c9; `docs/features/sign-in-guard/test-plan.md` (edge cases found during execution).
