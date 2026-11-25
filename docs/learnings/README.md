# Learnings

Dated traps that cost time. Each one is stated as the symptom you will see again, with the cause, the move that avoids it, and anchors in code, tests or commits.

Format: `.claude/HARNESS.md` section 8. Write them with the `learning` skill.

## Promotion

A learning that recurs is promoted in the same change that taught it again: a fact about the system to `.claude/rules/`, a process to `.claude/HARNESS.md`, a mechanical check to a hook, a repeatable procedure to a skill. Keep the learning and link to where it went.

Every learning touched by a change gets a `Revisited` line appended.

## Index

### testing

| Date | Title | File | Last revisited |
|------|-------|------|----------------|
| 2026-11-07 | A test that asserts no timing fails with a 5 s timeout and then later tests fail on leftover state | [2026-11-07-default-test-timeout-measures-the-machine-under-load.md](2026-11-07-default-test-timeout-measures-the-machine-under-load.md) | 2026-11-23 |
| 2026-11-23 | A test that catches an error thrown across Durable Object RPC still fails the whole Vitest run | [2026-11-23-an-error-thrown-across-durable-object-rpc-fails-the-vitest-run.md](2026-11-23-an-error-thrown-across-durable-object-rpc-fails-the-vitest-run.md) | 2026-11-23 |

### runtime

| Date | Title | File | Last revisited |
|------|-------|------|----------------|
| 2026-11-23 | A Durable Object fails its first call with SQLITE_AUTH when its schema is versioned by a PRAGMA | [2026-11-23-durable-object-sqlite-refuses-pragma-user-version.md](2026-11-23-durable-object-sqlite-refuses-pragma-user-version.md) | 2026-11-23 |
| 2026-11-23 | A failed MCP initialize answers HTTP 200, so a status check does not prove the handshake succeeded | [2026-11-23-an-mcp-sdk-error-answers-http-200.md](2026-11-23-an-mcp-sdk-error-answers-http-200.md) | 2026-11-23 |
| 2026-11-23 | The Worker answers 500 "no such table" under wrangler dev while every Vitest test passes | [2026-11-23-wrangler-dev-never-applies-d1-migrations.md](2026-11-23-wrangler-dev-never-applies-d1-migrations.md) | 2026-11-23 |
| 2026-11-24 | An ad-hoc signed app hangs on a Keychain prompt after a rebuild, or cannot write at all | [2026-11-24-an-ad-hoc-signed-app-cannot-keep-a-keychain-item-across-builds.md](2026-11-24-an-ad-hoc-signed-app-cannot-keep-a-keychain-item-across-builds.md) | 2026-11-24 |
| 2026-11-24 | A SwiftUI window crashes with EXC_BREAKPOINT when an inspector opens, or clips its sidebar at the minimum size | [2026-11-24-a-window-minimum-fed-from-measured-geometry-crashes-appkit.md](2026-11-24-a-window-minimum-fed-from-measured-geometry-crashes-appkit.md) | 2026-11-24 |
| 2026-11-24 | A menu bar extra closed from code needs two clicks to reopen, and its walk pops over the owner's screen | [2026-11-24-a-menu-bar-extra-closed-from-code-needs-two-clicks-to-reopen.md](2026-11-24-a-menu-bar-extra-closed-from-code-needs-two-clicks-to-reopen.md) | 2026-11-24 |
| 2026-11-24 | An ad-hoc signed App Group raises "would like to access data from other apps" after every rebuild and for every second process | [2026-11-24-an-ad-hoc-app-group-raises-a-consent-prompt-per-build-and-process.md](2026-11-24-an-ad-hoc-app-group-raises-a-consent-prompt-per-build-and-process.md) | 2026-11-24 |
| 2026-11-24 | A web view that is "non-persistent" still keeps its cookies across reloads | [2026-11-24-a-wkwebview-s-non-persistent-store-lives-as-long-as-the-view.md](2026-11-24-a-wkwebview-s-non-persistent-store-lives-as-long-as-the-view.md) | 2026-11-24 |
| 2026-11-24 | A new sidebar row crashes the app in a view that only shows for the other rows | [2026-11-24-a-swiftui-subtree-that-reads-the-selection-itself-renders-once-more-with-the-new-item.md](2026-11-24-a-swiftui-subtree-that-reads-the-selection-itself-renders-once-more-with-the-new-item.md) | 2026-11-24 |

### tooling

| Date | Title | File | Last revisited |
|------|-------|------|----------------|
| 2026-10-16 | A red-first commit must fail on the named assertion, not on a missing module or a broken helper | [2026-10-16-a-red-first-commit-must-fail-on-the-named-assertion.md](2026-10-16-a-red-first-commit-must-fail-on-the-named-assertion.md) | 2026-11-23 |
| 2026-10-16 | A red-first claim cannot be verified after the fact when the test and the code share a commit | [2026-10-16-commit-the-failing-test-first.md](2026-10-16-commit-the-failing-test-first.md) | 2026-11-23 |
| 2026-10-16 | A commit from one lane sweeps in files another lane staged in the same worktree | [2026-10-16-parallel-lanes-share-one-git-index.md](2026-10-16-parallel-lanes-share-one-git-index.md) | 2026-11-23 |
| 2026-10-17 | A guard hook blocks a harmless command because the forbidden flag appears in quoted prose | [2026-10-17-a-guard-hook-matches-the-flag-inside-quoted-prose.md](2026-10-17-a-guard-hook-matches-the-flag-inside-quoted-prose.md) | 2026-11-23 |
| 2026-10-17 | A `pnpm <name>` step is green in under a second and prints nothing the script would print | [2026-10-17-a-script-named-like-a-pnpm-built-in-never-runs.md](2026-10-17-a-script-named-like-a-pnpm-built-in-never-runs.md) | 2026-11-23 |
| 2026-10-17 | A session-start hook runs whatever a repository file contains when bash compares it with -ge | [2026-10-17-a-session-start-hook-runs-whatever-a-repository-file-contains.md](2026-10-17-a-session-start-hook-runs-whatever-a-repository-file-contains.md) | 2026-11-23 |
| 2026-10-17 | A hook that parses `git status --porcelain` maps a path with a space to the wrong folder | [2026-10-17-git-status-porcelain-quotes-paths-with-spaces.md](2026-10-17-git-status-porcelain-quotes-paths-with-spaces.md) | 2026-11-23 |
| 2026-10-17 | GitHub Actions may create no run for a push or PR, and tight API polling trips the secondary rate limit | [2026-10-17-github-actions-may-create-no-run-and-tight-polling-trips-the-rate-limit.md](2026-10-17-github-actions-may-create-no-run-and-tight-polling-trips-the-rate-limit.md) | 2026-11-23 |
| 2026-10-17 | pnpm's changed-since filter selects nothing in a linked worktree | [2026-10-17-pnpm-changed-since-selects-nothing-in-a-linked-worktree.md](2026-10-17-pnpm-changed-since-selects-nothing-in-a-linked-worktree.md) | 2026-11-23 |
| 2026-10-19 | A self-test that greps the whole output matches a commit hash | [2026-10-19-a-self-test-that-greps-the-whole-output-matches-a-commit-hash.md](2026-10-19-a-self-test-that-greps-the-whole-output-matches-a-commit-hash.md) | 2026-11-23 |
| 2026-10-19 | The index says Building for a feature that merged two days ago | [2026-10-19-shipped-status-written-in-follow-up-prs-goes-stale.md](2026-10-19-shipped-status-written-in-follow-up-prs-goes-stale.md) | 2026-11-23 |
| 2026-11-07 | The secrets gate fails on a branch whose own history is clean | [2026-11-07-gitleaks-git-scans-every-ref-unless-given-log-opts.md](2026-11-07-gitleaks-git-scans-every-ref-unless-given-log-opts.md) | 2026-11-23 |
| 2026-11-24 | `pnpm verify all` stops at the format gate on files the branch never touched | [2026-11-24-a-sibling-agent-worktree-fails-the-format-gate.md](2026-11-24-a-sibling-agent-worktree-fails-the-format-gate.md) | 2026-11-24 |
| 2026-11-24 | `wrangler deploy` lists the D1 binding with the nil preview id, though the Worker is bound to production | [2026-11-24-wrangler-deploy-lists-the-preview-database-id-in-its-bindings.md](2026-11-24-wrangler-deploy-lists-the-preview-database-id-in-its-bindings.md) | 2026-11-24 |
| 2026-11-25 | `wrangler dev` hands the Worker its upstream host, whatever host the client sent | [2026-11-25-wrangler-dev-hands-the-worker-its-upstream-host-whatever-the-client-sent.md](2026-11-25-wrangler-dev-hands-the-worker-its-upstream-host-whatever-the-client-sent.md) | 2026-11-25 |
