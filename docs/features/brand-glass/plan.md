# Plan: The Liquid Glass brand

**Spec:** spec.md
**Tier:** 🟢
**Seam:** the app target's resources, the widgets' header views, the README
**Assumptions (decided, owner can override):**
- ADR 0039, built while it is `Proposed`: the owner asked the loop to decide every call and review later (PROMPT.md, 2026-11-24).

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `tools/repository-shape/src/brand-assets.test.ts`, `docs/brand/todz-icon-check.svg` (new), `docs/brand/todz-icon-sparkle.svg` (new), `apps/macos/Todz/AppIcon.icon/` (new), `apps/macos/TodzWidgets/Views/WidgetBrandGlyph.swift` (new), `apps/macos/TodzWidgets/Views/WidgetHeader.swift`, `apps/macos/TodzWidgets/Views/NextUpView.swift`, `apps/macos/TodzWidgets/Views/TodayRing.swift`, `apps/macos/TodzWidgets/Views/WidgetPrompt.swift`, `apps/macos/README.md`, `docs/runbooks/render-the-brand-assets.md` | `developer` |
| Lead | `README.md`, `docs/screenshots/brand-glass/`, replaced shots under `docs/screenshots/widgets/` and `docs/screenshots/mac-app-shell/01-sign-in.png`, moved from the tester's scratchpad folder after its walk | lead |

## Sequencing

One group, then the tester, whose screenshots the lead commits.

## Steps

### G1

- [x] **Step 1 (`87ed6fd`):** Red: `brand-assets.test.ts` gains: the `.icon` document's `icon.json` names `macOS` among its squares, fills with a linear gradient from `#4C6BFF` to `#1B2A9E`, and holds the groups `sparkle` and `check`, each one glass layer; every layer names an image that exists in `Assets/`; each layer image is byte-identical to `docs/brand/todz-icon-<layer>.svg` and has the view box `80 80 864 864` at 1024; `WidgetHeader.swift`, `WidgetPrompt.swift`, `NextUpView.swift` and `TodayRing.swift` each draw `WidgetBrandGlyph`, whose file names an image set that exists in the catalog. Commit it failing alone.
- [x] **Step 2 (`8d88995`):** `docs/brand/todz-icon-check.svg` (the check as a filled outline, viewBox `80 80 864 864` at 1024) and `todz-icon-sparkle.svg`; `AppIcon.icon` with `icon.json` (the `#4C6BFF`→`#1B2A9E` gradient, a sparkle group and a check group, glass, neutral shadow) and the two copies. `xcodegen generate` adds it as `wrapper.icon`; build with no `actool` warning. Green for the icon tests.
- [x] **Step 3 (`6375b96`):** `WidgetBrandGlyph` (spec → Interfaces) and its use in the four titles. Build. Green.
- [x] **Step 4 (the docs commit after `6375b96`; the briefing notes that `widgetFamily` and `widgetRenderingMode` are read-only, so the scratch package edits three copied views and the accented look is not rendered):** The runbook gains: Xcode 27 or later and the `ictool` path in its tools step; the layer cut (the sparkle copied as is, the check outlined from the stroke's width, `todz-icon.svg` untouched) with `magick compare -metric AE` of the outline against the stroke's render reading 0 as its expected result; the copy into `AppIcon.icon`; the `ictool` renders of the six looks; each step with an expected result and an `If it fails` line. The app's README names the glass icon and the widgets' glyph (purpose only). Tester briefing, with how to render the widgets from their views: a scratch Swift package in the scratchpad that compiles `TodzWidgets/Views`, `Copy` and `TodzKit` and draws each view with `ImageRenderer` at the family's size, with `colorScheme` light and dark and `widgetRenderingMode` `.accented`.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | The compiler draws an SVG feature the spike did not try | a hairline or a missing layer in the `ictool` render or the system's icon | outline it as the check was, or fall back to a 1024 PNG layer |
| 2 | XcodeGen treats `AppIcon.icon` as a folder | `check.svg` appears as a loose resource in the pbxproj | name it with `type: file` in `project.yml` |
| 3 | The glyph crowds a small widget's title | the title truncates in the small render | shrink the glyph to the subheadline size |

**Steps with no backout:** none

## Z. Prove and ship

- [x] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [x] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence. Evidence: 8dd2642, at 1584b7e.
- [x] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`. Evidence: WITH RESERVATIONS at 1584b7e, then YES at 57c3bc2; security CLEAR.
- [x] **/check-ui:** screenshots recorded and uploaded (UI was touched). Evidence: the tester's shots, committed under `docs/screenshots/` and attached to the PR; no video (nothing moves).
- [x] **/open-pr:** gates passed, learnings sweep stated, PR opened. Evidence: [PR #17](https://github.com/dhyegocalota/todz/pull/17).
