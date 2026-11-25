# Tester briefing: Self-host docs

Written by the lead, who wrote the guide and its shape test.

## What changed

- `docs/self-host.md`: the guide.
- `README.md`: a link to it.
- `tools/repository-shape/src/self-host.test.ts`: eight checks that keep the guide true.
- ADR 0048.

## How to run

`pnpm --filter @todz/repository-shape exec vitest run src/self-host.test.ts`

## Hypotheses to attack

1. Every command in the guide exists in this repository as written. Break it by: running the local ones, or checking each named script, flag and file.
2. The shape test catches drift. Break it by: the two mutations in the test plan, plus one of your own.

## Known gaps

- Nothing remote is executed.
