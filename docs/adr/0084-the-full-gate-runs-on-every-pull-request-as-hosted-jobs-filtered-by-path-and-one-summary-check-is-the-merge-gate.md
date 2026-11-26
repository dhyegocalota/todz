# 0084. The full gate runs on every pull request as hosted jobs filtered by path, and one summary check is the merge gate

- Status: Accepted
- Date: 2026-11-26
- Deciders: Claude (the build loop's call under the owner's request); Dhyego Calota (owner) asked for the `verify` workflow on every pull request, "rápido e leve, roda só o que precisa e quando precisa", once the repository went public and hosted minutes became free
- Inspired by: [ADR 0005](0005-the-local-gate-runs-what-the-diff-can-break.md) (the gate is local, amended here), [ADR 0081](0081-the-whole-repository-is-agpl-3-0-only-and-going-public-follows-a-pre-flight-runbook.md) (the repository is public), the learning [GitHub Actions may create no run for a push or PR](../learnings/2026-10-17-github-actions-may-create-no-run-and-tight-polling-trips-the-rate-limit.md)

## Context

ADR 0005 kept hosted CI out of the merge path because it was private, metered and unreliable, and ran the gate on the developer's Mac. That Mac is now the bottleneck: lanes, simulators and the gate share it. A public repository has free Actions minutes, macOS runners included.

## Decision

1. **Triggers.** `verify.yml` runs on `pull_request` to `main` (opened, synchronize, reopened, ready for review) and on `workflow_dispatch`. There is no `push` trigger: `main` only receives pull requests that already passed.
2. **The whole gate, as hosted jobs.** Always: `checks` (format, typecheck, hooks, gate script, doctor), `unit` (repository-shape, types) and `security`. Filtered: `unit-server` (api, core, perf), `e2e` (Playwright with chromium), `docs` (`mint broken-links`) and `macos` (`swift test`, XcodeGen and the Debug build). Each job runs the repository's own scripts; the macOS commands live in `scripts/verify-macos.sh`, which the local gate calls too.
3. **Only what the diff can break.** A `changes` job reads the pull request's paths with `dorny/paths-filter`, pinned by SHA. `macos` runs on `apps/macos/**`; `unit-server` and `e2e` on `apps/api/**`, `libs/**` or `tools/perf/**`; `docs` on `apps/docs/**`. A change to `.github/**`, `scripts/**`, `package.json` or `pnpm-lock.yaml` runs every filtered job, and so does a dispatch.
4. **Cheap while a draft.** A draft pull request runs only the always-on jobs; the filtered jobs wait for ready for review, which triggers the run. No macOS runner starts unless Swift changed.
5. **One required check.** `ci-ok` always runs, needs every job, and passes when each job succeeded or was skipped; a failure or a cancellation fails it. Only `ci-ok` is the required status check, so a skipped job never blocks a merge and a job added later joins its `needs`.
6. **Least privilege, bounded and cached.** The token has `contents: read`; only `changes` adds `pull-requests: read`. A run per ref cancels the one in flight (`ci-<ref>`). Every job has a timeout. The pnpm store, the Playwright browsers (keyed by the Playwright version), SwiftPM and DerivedData are cached. Every action is pinned by SHA.
7. **The local `/verify` stays** for a developer's own loop and for the class-based plan of a branch; a hosted green `ci-ok` on the head is the merge gate.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Filtered hosted jobs and a summary check (chosen) | fast, free, no loaded Mac, one stable required check | a filter to keep honest; a skipped job reads as green | — |
| Every job on every pull request | no filter to maintain | a macOS runner and Playwright for a README typo | slow and wasteful |
| Keep the local gate only | no CI to maintain | the loaded Mac decides every merge | the owner's request |
| Trigger on push to `main` too | proves `main` | `main` only gets gated pull requests; doubles the runs | no gain |

## Consequences

- ADR 0005's item 7 is amended: the merge gate is the hosted `ci-ok` on the head after merging a fresh `origin/main`; `pnpm verify` remains the local loop.
- A pull request GitHub creates no run for is dispatched by hand, as the learning says.
- The branch protection rule requires `ci-ok`, not the individual jobs.
- Timing-budget tests measure the machine ([the 2026-11-07 learning](../learnings/2026-11-07-default-test-timeout-measures-the-machine-under-load.md)), so a hosted runner skips them and the local `/verify`, where ADR 0061's budgets were set, keeps them. A Swift budget test carries `.enabled(if: !isOnHostedRunner)`, and `swift-budget-tests.test.ts` fails when one does not.
- A path outside the filters runs only the always-on jobs, so a new top-level area adds its filter and job in the same change.

## Evidence

`tools/repository-shape/src/ci-workflow.test.ts` pins the triggers, the job list, the filters, the draft guard, the summary, the read-only permissions, the timeouts and the SHA pins. `scripts/verify.test.sh` pins the local macOS gate through the shared script.

## Revisit when

Hosted minutes stop being free, a filter is found to skip a job that a change broke, or the runners cannot build the Mac app.
