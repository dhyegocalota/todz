# Self-host docs

**Status:** In review
**Tier:** 🟢
**Owner approval:** approved 2026-11-24 by the owner's request to the loop ("faltou também as docs com info de self-host né… mantenha a docs curta porém certeira e pode publicar também"); publishing is the loop's call in [ADR 0048](../../adr/0048-the-self-host-guide-is-one-markdown-file-that-the-landing-serves.md)
**ADRs:** [0048](../../adr/0048-the-self-host-guide-is-one-markdown-file-that-the-landing-serves.md), [0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), [0045](../../adr/0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md)
**Not changing:** any code or configuration; serving the guide on `todz.app` (that is `landing`)

## Problem

Nothing tells someone how to run their own todz server, or how to point the app and an agent at it.

## Change

- `docs/self-host.md`, short and exact. It covers:
  - what you need;
  - forking and renaming the Wrangler values and the sender;
  - creating the database and applying the migrations;
  - deploying;
  - Email Sending;
  - Turnstile;
  - the app's `TODZ_API_BASE_URL` build setting;
  - the MCP command;
  - updating.
- The root README links it.
- `tools/repository-shape/src/self-host.test.ts` keeps it true, per ADR 0048 §2.

## Test list

- Red: `self-host.test.ts` > "the root README links it" fails before the README links the guide.
- Green: every test in `self-host.test.ts`.
- Mutation: rename the database in one command of the guide, and the database test fails.
