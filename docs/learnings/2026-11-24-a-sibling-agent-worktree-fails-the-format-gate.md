# `pnpm verify all` stops at the format gate on files the branch never touched
- Date: 2026-11-24
- Inspired by: `mac-sync` tester pass 1, where the gate failed on a developer lane created with `isolation: "worktree"`

## Signal
`pnpm verify all` stops at `format` and lists files under `.claude/worktrees/agent-<id>/`, though `git status` is clean and the branch never changed them.

## Cause
A sub-agent started with `isolation: "worktree"` gets a git worktree inside the repository, under `.claude/worktrees/`. Git ignores it as a nested worktree, but Prettier walks the folder and checks the other lane's copy of every file, often at another commit.

## Do
`.prettierignore` names `.claude/worktrees`. When a gate lists paths outside the branch, look for a sibling worktree before fixing anything; merge the lane and `git worktree remove` it when it is done.

## Anchor
`.prettierignore`; `docs/features/mac-sync/test-plan.md` (the `pnpm verify all` box of pass 1, BLOCKED, then green in pass 2).
