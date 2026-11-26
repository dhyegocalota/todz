# Plan: the menu bar count sits tight against the glyph

Lighter gates for a 🟢 fix: no plan review; reviewer findings below IMPORTANT land here.

- [x] (gap 12, 12, 11 points for 1, 12, 99+) Render the status item's image in-process from `origin/main`'s code at 2x on a light and a dark bar, and measure the gap (before)
- [x] (79dc1175) Red test: `MenuBarLayoutTests` pins the glyph margin, the count gap, the spacing, the text origin and the rise, against a stub that carries today's layout
- [x] (the fix commit) `MenuBarLayout` takes the tight numbers; `MenuBarCountImage` (the one path for every count; `MenuBarLabel` keeps the bare glyph for no count) and `MenuBarRibbonImage` read the spacing and the rise from it, and `menuBarLabelSpacing` goes
- [x] (gap 3, 3, 2 points; digits bottom row meets the checkmark, glyph alone identical; sets in the PR media per ADR 0047) Render again with the same harness (after), replace the README's menu bar count shot
- [x] (swift test 1448 tests passed, pnpm verify 6 gates green) `swift test`, `xcodebuild`, `/verify`, reviewer, PR

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| Negative spacing | The count overlaps the glyph for a digit with a small side bearing | The render's measured gap is 0 or less for `99+` | Revert the fix commit; the 8-point label returns |
| The ribbon's text origin moves with the spacing | The ribbon's crop starts inside the glyph | The expanded ribbon render shows a clipped checkmark | Revert the fix commit |
| The rise offsets the count | The count's top is clipped by the 18-point image | The count's ink rows start at 0 in the render | Set the rise to 0 |
