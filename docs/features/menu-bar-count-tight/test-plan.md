# Test plan: the menu bar count sits tight against the glyph

The status item is never driven: no synthetic input, no accessibility automation, never the installed or running app. The proof is the image the status item gets, rendered in-process by a scratch harness that compiles `MenuBarCountImage.swift`, `MenuBarRibbonImage.swift` and the menu bar copy against TodzKit and the compiled asset catalog, drawn at 2x on a light (`#EDEDF0`, ink black 85%) and a dark (`#29292E`, ink white 90%) bar, and measured column by column on the template's alpha.

## Unit

- [ ] `swift test --filter MenuBarLayoutTests` is red on the red commit (the stub carries today's 8-point spacing) and green on the fix commit.
- [ ] The whole `swift test` suite stays green.
- [ ] `xcodebuild` builds the Todz scheme.

## Renders (before on `origin/main`, after on the fix)

- [ ] `1`: visible gap from the glyph's ink to the count's ink is 2 to 3 points after (12 before).
- [ ] `12`: visible gap 2 to 3 points after (12 before).
- [ ] `99+`: visible gap 2 to 3 points after (11 before), never 0 or less.
- [ ] The digits' bottom ink row meets the checkmark's bottom ink row (half a point lower before).
- [ ] No trailing padding beyond the count's own side bearing: the image ends within 1.5 points of the last ink column.
- [ ] Count 0 or the count switched off: the glyph alone, identical before and after.
- [ ] Day temperature noon (0.85), afternoon (0.75) and evening (0.65): the same gap as the plain count, the glyph columns at full ink.
- [ ] The ribbon's expanded frame (`3 left · next: T-12 Review PR`): the text starts at the same gap, the checkmark is not clipped.
- [ ] Every render reads on both the light and the dark bar (the image is a template: one alpha mask tinted per bar).
