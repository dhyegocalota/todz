# Plan: The Liquid Glass brand

**Spec:** spec.md
**Tier:** 🟢
**Seam:** the app target's resources, the widgets' header views, the README
**Assumptions (decided, owner can override):**
- ADR 0039.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `tools/repository-shape/src/brand-assets.test.ts`, `docs/brand/todz-icon-check.svg` (new), `docs/brand/todz-icon-sparkle.svg` (new), `apps/macos/Todz/AppIcon.icon/` (new), `apps/macos/TodzWidgets/Views/WidgetBrandGlyph.swift` (new), `apps/macos/TodzWidgets/Views/WidgetHeader.swift`, `apps/macos/TodzWidgets/Views/NextUpView.swift`, `apps/macos/TodzWidgets/Views/TodayRing.swift`, `apps/macos/README.md`, `docs/runbooks/render-the-brand-assets.md` | `developer` |
| Lead | `README.md`, `docs/screenshots/brand-glass/`, replaced shots under `docs/screenshots/widgets/` and `docs/screenshots/mac-app-shell/01-sign-in.png`, after the tester's walk | lead |

## Sequencing

One group, then the tester, whose screenshots the lead commits.

## Steps

### G1

- [ ] **Step 1:** Red: `brand-assets.test.ts` gains: the `.icon` document's `icon.json` names `macOS` among its squares and holds at least two groups; every layer names an image that exists in `Assets/`; each layer image is byte-identical to `docs/brand/todz-icon-<layer>.svg`; `WidgetHeader.swift`, `NextUpView.swift` and `TodayRing.swift` each draw `WidgetBrandGlyph`, whose file names an image set that exists in the catalog. Commit it failing alone.
- [ ] **Step 2:** `docs/brand/todz-icon-check.svg` (the check as a filled outline, viewBox `80 80 864 864` at 1024) and `todz-icon-sparkle.svg`; `AppIcon.icon` with `icon.json` (the `#4C6BFF`→`#1B2A9E` gradient, a sparkle group and a check group, glass, neutral shadow) and the two copies. `xcodegen generate` adds it as `wrapper.icon`; build with no `actool` warning. Green for the icon tests.
- [ ] **Step 3:** `WidgetBrandGlyph` and its use in the three headers. Build. Green.
- [ ] **Step 4:** The runbook gains the layer cut, the copy into `AppIcon.icon` and the `ictool` renders of the six looks, each step with an expected result and an `If it fails` line; the app's README names the glass icon and the widgets' glyph (purpose only). Tester briefing, with how to render the widgets in light and dark from their views.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | The compiler draws an SVG feature the spike did not try | a hairline or a missing layer in the `ictool` render or the system's icon | outline it as the check was, or fall back to a 1024 PNG layer |
| 2 | XcodeGen treats `AppIcon.icon` as a folder | `check.svg` appears as a loose resource in the pbxproj | name it with `type: file` in `project.yml` |
| 3 | The glyph crowds a small widget's title | the title truncates in the small render | shrink the glyph to the subheadline size |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** screenshots recorded and uploaded (UI was touched).
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
