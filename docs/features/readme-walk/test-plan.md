# Test plan: README walk

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [x] No new test: the existing `tools/repository-shape/src/product-screenshots.test.ts` and `delivery-docs.test.ts` pin the walk. Mutation check: put back one deleted PNG without a README cell — expected: "the root README shows every screenshot" fails naming it; delete it again — expected: green — evidence: restored mac-sync/02-offline-changes-waiting.png from origin/main; "the root README shows every screenshot" failed (1 failed, 209 passed) with the path listed; deleted it again, 209 of 209 green, git status clean

## Unit

- [x] `pnpm --filter @todz/repository-shape exec vitest run` — expected: all green — evidence: 16 files, 209 of 209 passed
- [x] Every image path in the README's walk section exists on disk — expected: 12 of 12, plus the hero — evidence: 13 distinct paths in README.md, all 13 exist (the hero is mac-app-shell/04-inspector-notes-and-history.png)
- [x] `docs/screenshots/` holds exactly the 13 PNGs the README shows (12 walk cells and the hero) — expected: no extra file — evidence: find lists 13 files; diff against the README paths is empty

## Prove it for real

- [x] The README rendered on GitHub at the branch (`gh api` or `gh browse` URL rendered in a browser, or the Markdown rendered locally) — expected: the hero, then six rows of two images, in ADR 0047's order, every image loading, captions under each — evidence: scripted local render (pandoc to HTML, Google Chrome headless; Playwright MCP Chrome missing), /private/tmp/claude-501/-Users-dhyegocalota-Projects-todz-todz/0f431f9e-ca7a-43f3-81bd-a24c5f87032b/scratchpad/readme-walk-shots/readme-1280.png shows hero and rows 1-4 in order, all loading, captions present; the capture was cut at row 4, rows 5-6 read in the 375 capture
- [x] Narrow width (375) — expected: the table scrolls or stacks without broken images — evidence: /private/tmp/claude-501/-Users-dhyegocalota-Projects-todz-todz/0f431f9e-ca7a-43f3-81bd-a24c5f87032b/scratchpad/readme-walk-shots/readme-375.png: all 12 images load in 6 rows, the table scrolls inside its block (right column clipped by the viewport, none broken); GitHub's own table CSS not checked

## Edge cases found during execution

- The menu bar count image is a short banner, so its row leaves empty space beside the tall popover shot; cosmetic, not a defect.

## Coverage honesty

- What the owner calls "makes sense" is a judgment; ADR 0047 records the cut for him to overturn.
