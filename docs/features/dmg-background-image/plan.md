# Plan: the released DMG shows its background picture in Finder

- [x] Record the cause and the repair as ADR 0095
- [x] Red test: the layout carries every icon view key Finder requires
- [x] Add the four keys to `apps/macos/release/dmg-layout.dsstore`
- [x] Prove by hand on a freshly built image opened in Finder

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| Rewrite the layout | Finder still drops the record | The window opens plain | Revert the commit; the release stays valid |
