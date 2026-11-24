# A test that catches an error thrown across Durable Object RPC still fails the whole Vitest run
- Date: 2026-11-23
- Inspired by: `project-store` spike and step 3 (`apps/api/test/project-store.test.ts`), [ADR 0015](../adr/0015-the-project-store-answers-with-results-not-thrown-errors.md)
- Revisited: 2026-11-23 — still true with `@cloudflare/vitest-plugin` 1.9.0 and Vitest 5.0.5
- Revisited: 2026-11-23 — still true in `owner-api`: the red stubs of `readChanges`, `readHistory` and `fetch` returned wrong results instead of throwing

## Signal
A test awaits a Durable Object stub method that throws, catches the rejection and asserts on it, and passes; yet the run ends red with an unhandled error, and the output prints `uncaught exception; source = Uncaught (in promise)` with the stack of the throw inside the object. The caught error has lost its class and its own fields.

## Cause
workerd reports an exception thrown inside the Durable Object as uncaught in the object's own context before the caller's promise rejects, and the Workers Vitest integration turns that report into an unhandled error of the run. RPC serialises only the message and a built-in error type, so a custom error class never reaches the caller.

## Do
Make expected failures values, not throws (ADR 0015). Assert a throw that only a caller's bug can cause inside the object with `runInDurableObject` from `cloudflare:test`, calling the method on the instance, instead of through the stub.

## Anchor
- `apps/api/src/project-store.ts`
- `apps/api/test/project-store.test.ts`
- commits `1e2b585` (red), `ff3004a` (green)
