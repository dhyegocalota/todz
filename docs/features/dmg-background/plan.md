# Plan: the release DMG opens on a branded window

- [x] Decide the layout method as ADR 0083 (`ebcfbde9`)
- [x] Red test: the staged folder holds the background and layout, a missing one is refused (`5f1df6a6`)
- [x] Background art, layout file and `create_disk_image` change (`fa386eab`)
- [x] The 2x representation carries 144 dpi

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| Copy the layout | Finder ignores the copied `.DS_Store` | The window opens plain | Revert the commit; the release stays valid |
