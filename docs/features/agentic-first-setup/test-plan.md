# Test plan: agentic-first setup

Shape tests run with Vitest in `tools/repository-shape`; the walk follows the runbooks as a fresh agent would, in a scratch worktree that is never committed.

## Shape

- [ ] The README opens its install part with the self-host prompt and its contributing part with the development prompt, each in a `text` code block.
- [ ] `.github/CONTRIBUTING.md` opens with the development prompt.
- [ ] `apps/docs/self-host.mdx` and its seven twins open with the self-host prompt, in English, before one accordion.
- [ ] Each prompt is at most two lines and names an address that resolves to an existing runbook; a missing target and an outside address are reported.
- [ ] The README and the contributing guide keep their manual commands in a closed `<details>` with the summary "Do it by hand".
- [ ] Every runbook step has an expected result and an `If it fails` line, and the runbooks index links both runbooks once.

## Docs

- [ ] The twins tests of `docs-languages.test.ts` and the self-host guide tests still pass with the accordion and the prompt.
- [ ] `pnpm --filter @todz/docs broken-links` and `pnpm --filter @todz/docs validate` report nothing.

## The walk

- [ ] Development: in a scratch worktree, follow `set-up-for-development.md` step by step: doctor, install, `pnpm verify all` green. Result recorded below.
- [ ] Self-host: follow `self-host-with-an-agent.md` in a scratch worktree with an empty home, up to its first login stop. Result recorded below; nothing is deployed.

## Results

Recorded after the walk.
