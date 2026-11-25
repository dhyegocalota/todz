# The `macos` gate failed once and passed on retry, and five runs of its commands on a busy machine did not reproduce it

- Date: 2026-11-25
- Inspired by: PR #32 (`macos` red once, green on retry) and `security-fixes` item 9
- Revisited: 2026-11-25 — still true (written the same day)

## Signal

`pnpm verify` stops at the `macos` gate with no change to the code, and the same commit passes on the next run. The failing log was not kept, so the cause was never named.

## Cause

Not reproduced in five runs. `gate_macos` runs `swift test --package-path apps/macos/TodzKit`, `xcodegen generate --spec apps/macos/project.yml` and `xcodebuild build … -configuration Debug -derivedDataPath apps/macos/build` in one chain. Each of the five runs, in a lane worktree at load average 6 to 10 (the sibling macOS lane was building in parallel, and one `swift-test` of that lane was running when the first run began), passed all three commands: 828 tests in 57 suites, `xcodegen` and `xcodebuild` exit 0. Runs two to five reused the first run's `.build` and derived data, so they exercised incremental builds only. The candidates stay open: a shared `.build` or `apps/macos/build` between runs, the global module cache, a test timing out under load ([the timeout learning](2026-11-07-default-test-timeout-measures-the-machine-under-load.md)), `xcodebuild` derived-data contention, a parallel test run.

## Do

No gate change was made, because a fix without a cause would hide a real failure. When the gate fails again, keep the full log of the failing command before retrying, record `uptime` and `pgrep -fl 'xcodebuild|swift-build|swift-test'` at the start, and name the cause here.

## Anchor

`scripts/verify.sh` (`gate_macos`), `scripts/verify-gates.tsv`, `docs/features/security-fixes/plan.md` steps 19 to 22.
