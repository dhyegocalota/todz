# 0012. Worker tests run inside workerd

- Status: Proposed
- Date: 2026-11-23
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (local development runs entirely on Wrangler and the local Durable Object runtime; an isolation suite runs in the gate), the `project-store` spike of 2026-11-23

## Context

`apps/api` is a Cloudflare Worker with a D1 directory and one SQLite Durable Object per project. Its tests must exercise the real SQL engines and the real Durable Object addressing, because the isolation suite is only worth something against the runtime that will serve production. The repository runs Vitest 5 everywhere. `@cloudflare/vitest-pool-workers`, the integration most guides name, stops at Vitest 4; its successor `@cloudflare/vitest-plugin` accepts Vitest 4 or 5.

## Decision

1. `apps/api` tests run inside workerd through `@cloudflare/vitest-plugin`, configured from the package's own `wrangler.jsonc`, on the repository's Vitest 5.
2. D1 migrations are read from the package's `migrations/` folder and applied by the tests, the same files Wrangler applies.
3. Storage persists across the tests of one file, so every test creates its own owner, workspace and project ids and never depends on another test's rows.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| `@cloudflare/vitest-plugin` inside workerd (chosen) | real D1 and Durable Object SQLite, direct RPC to stubs, same Vitest as the rest | one more dev dependency that tracks workerd | none blocking |
| `@cloudflare/vitest-pool-workers` | widely documented | requires Vitest 4, a second Vitest major in one repository | two majors of the test runner |
| Vitest in Node driving `wrangler dev` or Miniflare over HTTP | no runtime-specific test API | every test needs an HTTP surface the feature does not have yet; slower; ports to manage | tests would shape the API |
| An in-memory fake of D1 and Durable Objects | fast | proves nothing about the runtime that isolates projects | the isolation suite must run on the real engine |

## Consequences

- `pnpm test:unit` in `apps/api` boots workerd; the binary comes with Wrangler's dependency on `workerd`.
- The test runtime API is `cloudflare:test` and `cloudflare:workers`; Node APIs are not available inside those tests.

## Evidence

Spike in a scratch folder on 2026-11-23 with `@cloudflare/vitest-plugin` 1.9.0, Vitest 5.1.1 and Wrangler 4.167.0: a D1 migration applied, a row read back, a SQLite Durable Object kept separate rows for two names, a throwing `transactionSync` left no row behind, and a second test in the same file saw the first test's rows.

## Revisit when

- The plugin falls behind the repository's Vitest major.
- A test needs something only a deployed Worker shows.
