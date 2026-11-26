# Tester briefing: Production smoke walk

Written by the developer. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `docs/runbooks/production-smoke-walk.md`: the walk, seventeen steps and an empty Run log.
- `docs/runbooks/README.md`: the index row and the exception sentence.
- `tools/repository-shape/src/runbooks.test.ts`: the exception sentence constant.

## How to run

```bash
pnpm --filter @todz/repository-shape exec vitest run src/runbooks.test.ts src/feature-status.test.ts
```

## What to attack

- Steps 4 to 6 against the code answers of `sign-in-links.ts`, `owner-sign-in.ts` and `waitlist-join.ts`.
- Steps 7 to 12 and 15 are the owner's session; confirm each says who does it and what the owner sees.
- Steps 2 and 15 are conditional; confirm each says what to write when the feature is not deployed.
