# A test that asserts no timing fails with a 5 s timeout and then later tests fail on leftover state

- Date: 2026-11-07
- Inspired by: two integration tests failing in `pnpm verify all` on a machine at load 40 to 100
- Revisited: 2026-11-07 — still true
- Revisited: 2026-11-23 — carried into this repository with the harness; still true

## Signal
A test with 30 sequential calls reports `Test timed out in 5000ms`, and tests after it in the same file fail on state the abandoned test left behind.

## Cause
Vitest's default `testTimeout` and `hookTimeout` are 5 s. A busy machine stretches an ordinary test past that. The abandoned test keeps awaiting calls while `afterEach(reset)` wipes the shared state under them, and the next test inherits the wreckage.

## Do
Set `testTimeout` and `hookTimeout` explicitly in every Vitest configuration, and the four timeouts in every Playwright configuration, as named constants; a test that asserts real timing keeps its own bound. A hook that resets shared state first settles the work the test left in flight. The `test-timeouts.test.ts` shape test fails when a configuration lacks them.

## Anchor
`tools/repository-shape/src/test-timeouts.test.ts`
