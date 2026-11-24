# A Durable Object fails its first call with SQLITE_AUTH when its schema is versioned by a PRAGMA
- Date: 2026-11-23
- Inspired by: `project-store` plan review and spike (`apps/api/src/project-schema.ts`)
- Revisited: 2026-11-23 — still true on the workerd that `@cloudflare/vitest-plugin` 1.9.0 runs
- Revisited: 2026-11-23 — still true in `owner-api`: version 2 is applied from the `schema_version` table inside `transactionSync`

## Signal
`ctx.storage.sql.exec('PRAGMA user_version')`, reading or writing, throws `Error: not authorized: SQLITE_AUTH`, so a constructor that versions its schema that way breaks every call to the object.

## Cause
Durable Object SQLite runs behind an authorizer that allows only a short list of PRAGMAs; `user_version` is not on it.

## Do
Keep the schema version in a one-row table of the object's own database, read and written inside the same `blockConcurrencyWhile` that applies the schema. Check a PRAGMA in a spike before a spec relies on it.

## Anchor
- `apps/api/src/project-schema.ts`
- `docs/features/project-store/spec.md` → Project database
