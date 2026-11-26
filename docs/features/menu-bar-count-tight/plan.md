# Plan: the menu bar count sits tight against the glyph

Lighter gates for a 🟢 fix: no plan review; reviewer findings below IMPORTANT land here.

- [ ] Render the status item's image in-process from `origin/main`'s code at 2x on a light and a dark bar, and measure the gap (before)
- [ ] Red test: `MenuBarLayoutTests` pins the glyph margin, the count gap, the spacing, the text origin and the rise, against a stub that carries today's layout
- [ ] `MenuBarLayout` takes the tight numbers; `MenuBarCountImage`, the switch-off label in `MenuBarLabel` and `MenuBarRibbonImage` read the spacing and the rise from it, and `menuBarLabelSpacing` goes
- [ ] Render again with the same harness (after), commit both sets under `media/`, replace the README's menu bar count shot
- [ ] `swift test`, `xcodebuild`, `/verify`, reviewer, PR

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| Negative spacing | The count overlaps the glyph for a digit with a small side bearing | The render's measured gap is 0 or less for `99+` | Revert the fix commit; the 8-point label returns |
| The ribbon's text origin moves with the spacing | The ribbon's crop starts inside the glyph | The expanded ribbon render shows a clipped checkmark | Revert the fix commit |
| The rise offsets the count | The count's top is clipped by the 18-point image | The count's ink rows start at 0 in the render | Set the rise to 0 |
