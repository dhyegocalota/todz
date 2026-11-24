# 0026. A native app is walked with computer use and recorded from its screenshots

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [HARNESS](../../.claude/HARNESS.md) §0 invariant 6 and §5 Prove, [ADR 0006](0006-pull-request-media-is-attached-with-the-github-cli.md), the `mac-app-shell` spike of 2026-11-24

## Context

The harness proves user-facing changes with a Playwright MCP walk and records PR media with Playwright's `recordVideo`. A native SwiftUI window is not a browser page, so Playwright cannot see it. XCUITest can drive it, but its runner needs a signed test bundle and the Accessibility permission granted by a person, which an unattended run cannot do. The machine has Orca's computer use, which reads a window's accessibility tree, clicks, types and takes window screenshots in the background, without moving the owner's pointer.

## Decision

1. The tester walks the macOS app with Orca computer use (`orca computer get-app-state`, `click`, `set-value`, `type-text`, `wait`) against `wrangler dev`, from the user's side: it asserts what the accessibility tree and the screenshot show, takes the unhappy paths, and covers empty, one and many tasks. Never `--restore-window` without the owner.
2. The walk's screenshots are the PR's screenshots. The video is built from them: ffmpeg turns the ordered frames into an `.mp4` and a `.gif`, attached with `scripts/pr-media.sh` (ADR 0006).
3. The API client is also proven against the real Worker: a `TodzKit` suite marked `.enabled(if:)` on `TODZ_LIVE_API_URL` runs the sign-in, workspace, task and feed calls against `wrangler dev`. The tester runs it; the `macos` gate runs the stubbed suites only, so the gate never boots a server.
4. The window's narrow width is the window's minimum size, not 375 pixels.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Orca computer use, frames to video (chosen) | works unsigned and unattended, background input | the video is a slideshow of steps | — |
| XCUITest | Apple's tool, repeatable in the gate | signed runner, a person grants Accessibility | not possible unattended without a team |
| `screencapture -v` while a script drives the app | a real video | needs the Screen Recording permission and the foreground | takes over the owner's screen |
| Snapshot images rendered with `ImageRenderer` in tests | headless, in the gate | not the running app, no real data | proves layout, not the flow |

## Consequences

- The PR template's "Playwright MCP walk" box reads as "Orca walk" for the macOS app; web surfaces keep Playwright.
- When a team exists, an XCUITest smoke test in the gate becomes possible and this ADR is revisited.

## Evidence

`orca computer capabilities --json` on 2026-11-24 reports background input, screenshots, element frames and tree diffs on macOS.

## Revisit when

- A signing team exists (XCUITest becomes possible).
- Orca's computer use is unavailable on the machine that runs the loop.
