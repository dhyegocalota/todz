# Plan: The todz brand

**Spec:** spec.md
**Tier:** 🟢
**Seam:** the asset catalog, `MenuBarLabel`, the README header
**Assumptions (decided, owner can override):**
- ADR 0038.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `tools/repository-shape/src/brand-assets.test.ts` (new), `apps/macos/Todz/Assets.xcassets/AppIcon.appiconset/`, `apps/macos/Todz/Assets.xcassets/MenuBarGlyph.imageset/`, `apps/macos/project.yml`, `apps/macos/Todz/MenuBar/MenuBarLabel.swift`, `apps/macos/README.md`, `README.md`, `docs/brand/`, `docs/runbooks/render-the-brand-assets.md`, `docs/runbooks/README.md` | `developer` |

## Sequencing

One group, after `owner-check-notes` merges (it may touch the menu bar files).

## Steps

### G1

- [ ] **Step 1:** Red: `brand-assets.test.ts` reads `AppIcon.appiconset/Contents.json` and checks that every image it names exists with the pixel size its `size` × `scale` gives (from the PNG header), that the set covers 16, 32, 128, 256 and 512 at 1× and 2×, and that `MenuBarGlyph.imageset/Contents.json` names one PDF with `template-rendering-intent: template` and `preserves-vector-representation: true`. Commit it failing alone.
- [ ] **Step 2:** Render with `rsvg-convert` from `docs/brand/`: the ten app icon PNGs and their `Contents.json`; `MenuBarGlyph.pdf` and its `Contents.json`. Set `ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon` in `project.yml`. Green.
- [ ] **Step 3:** `MenuBarLabel` uses the glyph; build with no warning (no "unassigned child" or missing-size warning from `actool`).
- [ ] **Step 4:** README: the lockup as the header (replacing the plain `<h1>`, with the alt text "todz"), the icon at 128 above the hero screenshot. The runbook `render-the-brand-assets.md` (each step with an expected result and an `If it fails` line) and its row in the runbooks index. The app's README names the icon and glyph (purpose only). Tester briefing.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | `rsvg-convert` drops the drop-shadow filter | the rendered 1024 PNG differs visibly from the owner's `todz-icon-1024.png` | render with `magick` instead and record it in the runbook |
| 3 | The glyph renders black on a dark bar | the status item is invisible in dark mode | the imageset's template intent was not set |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/check-ui:** the Dock, the About panel and the status item, light and dark.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
