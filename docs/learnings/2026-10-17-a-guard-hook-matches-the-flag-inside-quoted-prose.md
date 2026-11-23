# A guard hook blocks a harmless command because the forbidden flag appears in quoted prose
- Date: 2026-10-17
- Inspired by: editing `.claude/HARNESS.md` through a shell heredoc while adding the merge-sensitivity rule; `guard-git-add-all.sh`
- Revisited: 2026-10-17 — still true
- Revisited: 2026-11-04 — ported with the harness from [superdoc-collab](https://github.com/dhyegocalota/superdoc-collab); the paths under Inspired by and Anchor name that repository
- Revisited: 2026-11-23 — carried into this repository with the harness; still true
- Revisited: 2026-11-23 — `task-core`: `guard-secrets.sh` does the same to prose. A pair of backticks anywhere in the command, a Markdown code span included, counts as a shell expansion, and a word that starts with a dot and holds `*`, `?` or `[` (`.[ab]`, a regex in a Python heredoc) counts as a glob that could name a dotenv file, so a heredoc of Markdown or Python is blocked. Same move: write the text or the script with the `Write` tool and run it by path

## Signal
A Bash call that only writes or prints text is refused with `Blocked: --no-verify skips the gates this repo depends on.` although it never runs git. The text being written quotes the flag, for example a harness paragraph, a learning or a test fixture.

## Cause
`guard-git-add-all.sh` matches the flag anywhere in `tool_input.command`, including inside heredocs, `printf` arguments and Python strings. That is deliberate: a hook that parses shell to find the "real" command would be larger than the rule it enforces, and the false positive costs one retry while a false negative costs a skipped gate.

## Do
Write prose that quotes a guarded flag with the `Write` or `Edit` tool, or from a script file created with them, and run the script by path. Do not weaken the hook. If a fixture must contain the flag, build it from pieces in the script (`"--no-" + "verify"`) so the hook's own tests can still exercise the real string.

## Anchor
- `.agents/hooks/guard-git-add-all.sh`
- `.agents/hooks/hooks.test.sh` (fixtures written with the `Write` tool for this reason)
- `.claude/HARNESS.md` section 12
