# Test plan: agentic-first setup

Shape tests run with Vitest in `tools/repository-shape`; the walk follows the runbooks as a fresh agent would, in a scratch worktree that is never committed.

## Shape

- [x] The README opens its install part with the self-host prompt and its contributing part with the development prompt, each in a `text` code block.
- [x] `.github/CONTRIBUTING.md` opens with the development prompt.
- [x] `apps/docs/self-host.mdx` and its seven twins open with the self-host prompt, in English, before one accordion.
- [x] Each prompt is at most two lines and names an address that resolves to an existing runbook; a missing target and an outside address are reported.
- [x] The README and the contributing guide keep their manual commands in a closed `<details>` with the summary "Do it by hand".
- [x] Every runbook step has an expected result and an `If it fails` line, and the runbooks index links both runbooks once.

## Docs

- [x] The twins tests of `docs-languages.test.ts` and the self-host guide tests still pass with the accordion and the prompt.
- [x] `pnpm --filter @todz/docs broken-links` and `pnpm --filter @todz/docs validate` report nothing.

## The walk

- [x] Development: in a scratch worktree, follow `set-up-for-development.md` step by step: doctor, install, `pnpm verify all` green. Result recorded below.
- [x] Self-host: follow `self-host-with-an-agent.md` in a scratch worktree with an empty home, up to its first login stop. Result recorded below; nothing is deployed.

## Results

Walked on 2026-11-27 at commit `32ec17e5`, in a detached scratch worktree under the scratchpad, removed afterwards.

- Development runbook: step 1 was the worktree itself (`AGENTS.md` and `.nvmrc` present, `git status` clean); step 2 printed `doctor: 0 missing required, 0 missing optional`; step 3 `pnpm install --frozen-lockfile` finished in 5.2 s; step 4 `pnpm verify all` ended `verify: 9 gates green at 32ec17e5 (product)` (unit 353 s, e2e 42 s, macos 54 s, docs 18 s, including the docs browser walk of the self-host page with its accordion). Steps 5 and 6 are reading and reporting. Not walked: the fork and clone of step 1 on a machine without a clone.
- Self-host runbook: steps 1 and 2 are the same doctor, install and gate as above. Step 3, `wrangler whoami` with an empty home directory and no token, answered `You are not authenticated. Please run wrangler login.`: the first login stop, where the runbook says to stop and ask the owner for `wrangler login`. Nothing was renamed, created or deployed.
