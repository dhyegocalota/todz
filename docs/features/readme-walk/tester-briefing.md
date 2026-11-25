# Tester briefing: README walk

Written by the lead, who made the change (two files and the screenshots).

## What changed

- `README.md`: the walk table keeps twelve cells in ADR 0047's order.
- `docs/screenshots/`: eleven PNGs deleted (setup, error states and light/dark variants).
- `docs/adr/0047-*.md` and the two indexes.

## How to run

`pnpm --filter @todz/repository-shape exec vitest run`; render `README.md` (push the branch and open it on GitHub, or a local Markdown preview).

## Hypotheses to attack

1. Every kept cell's image exists and loads. Break it by: listing the README's image paths and testing each.
2. No PNG is left unshown. Break it by: putting one deleted shot back.

## Known gaps

- None beyond the judgment of the cut.
