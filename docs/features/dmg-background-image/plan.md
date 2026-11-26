# Plan: the released DMG shows its background picture in Finder

- [x] Record the cause and the repair as ADR 0095 (`01872731`)
- [x] Red test: the layout carries every icon view key Finder requires (`34da1bb2`)
- [x] Add the four keys to `apps/macos/release/dmg-layout.dsstore` (`9d24deaa`)
- [x] Decode the `icvp` record in the test instead of grepping bytes (`1cf9205d`)
- [x] Prove by hand on a freshly built image opened in Finder (`.pr-media/dmg-before.png`, `.pr-media/dmg-after.png`, attached to PR #87)

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| Rewrite the layout | Finder still drops the record | The window opens plain | Revert the commit; the release stays valid |
