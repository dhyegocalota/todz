# Test plan: The todz brand

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `tools/repository-shape/src/brand-assets.test.ts` — input: the red commit (no `AppIcon.appiconset`, no `MenuBarGlyph.imageset`); expected: fails naming the missing `Contents.json`
- [ ] Confirmed it fails for the right reason: the failure text recorded

## Unit

- [ ] Every app icon image named in `Contents.json` exists at its pixel size; expected: green
- [ ] The sizes 16, 32, 128, 256, 512 at 1× and 2× are all present; expected: green
- [ ] `MenuBarGlyph` is one PDF, template intent, vector preserved; expected: green
- [ ] `pnpm verify all`: green, gates recorded

## Prove it for real — the app (ADR 0026)

- [ ] The built `Todz.app` in Finder and the Dock shows the owner's icon (screenshot of the Finder icon via Quick Look or `qlmanage -t`)
- [ ] The About panel (app menu → About todz) shows the icon
- [ ] The status item shows the glyph, not `checkmark.square`, on this Mac's bar, with the count after it when Today has open tasks; screenshot replaces `docs/screenshots/menu-bar-count/01-count.png`
- [ ] With the switch off, the glyph alone, tinted like the bar's other items
- [ ] The README on GitHub shows the lockup header and the icon above the screenshot (render the branch's README with `gh` or open the file view)

## Edge cases found during execution

## Adversarial review

- [ ] Claim 1: the rendered icon matches the owner's own render — attack: compare `AppIcon` 1024 with `todz-loop/brand/todz-icon-1024.png`; result: <refuted | held>
- [ ] Claim 2: the glyph is a template — attack: a dark and a light menu bar; result: <refuted | held>
- [ ] Claim 3: no build warning from the asset catalog — attack: read the `actool` lines of the build log; result: <refuted | held>

## Coverage honesty

- A light menu bar may not be reproducible on this Mac (the `menu-bar-count` tester could not); then the light half is on the Human checklist.
