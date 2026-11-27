# Agentic-first setup

**Status:** Shipped 2026-11-27
**Tier:** 🟡 (public docs, two runbooks and their shape tests; no server, no schema, no app code)
**Owner approval:** the owner's order of 2026-11-27: "quero o self-host e dev environment para contribuir 100% agêntico com um prompt simples (1 ou 2 linhas no máximo) no início… óbvio que se a pessoa quiser saber cada comando ok, mas agentic-first".
**ADRs:** [0124](../../adr/0124-setup-starts-from-a-one-line-prompt-and-an-agent-readable-runbook-behind-it.md)
**Not changing:** the self-host steps themselves, the Worker, the Mac app and the guide's tests of names and commands

## Problem

Self-hosting and setting up a development machine are long, command-by-command pages. The owner wants a person to paste one or two lines into a coding agent and have it do everything, while anyone who wants the commands still finds them.

## Goals

- The root README (its install and contributing parts), `apps/docs/self-host.mdx` with its seven twins and `.github/CONTRIBUTING.md` each open with a copyable prompt of at most two lines in a code block.
- Behind each prompt, an English runbook an agent runs unattended: `docs/runbooks/self-host-with-an-agent.md` and `docs/runbooks/set-up-for-development.md`, every step with a command, an expected result and an `If it fails` line, stopping only for a login, a payment, a secret or the choice of a domain.
- The manual commands that exist today stay, collapsed under "Do it by hand": `<details>` on GitHub, a Mintlify `<Accordion>` in the docs.
- The prompt text stays English in every language; the twins translate only the sentence that introduces it and the accordion title.

## Non-goals

- A `todz` command line that performs the setup; the Mac app build, which needs the owner's Apple team.
- Running a self-host deploy anywhere: the walk stops at its first login.

## Design

- The prompts point at the runbooks by their raw GitHub address, because the self-host guide is the reference for people and its translations cannot carry expected results and failure lines.
- `tools/repository-shape/src/agentic-first-setup.test.ts` pins each prompt at the top of its file, at most two lines, with an address that resolves to a runbook of the repository, and the collapsed section in every file.
- The runbooks index states that these two runbooks are run by agents for their owner, and that the build loop walks the self-host one only to its first login.

## Failure handling

- A prompt that drifts between files, a missing runbook, a missing accordion in a twin or a changed code block fails the shape tests.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Prompt target for self-host | The docs `.md` form, a runbook in the repository | The loop's call: a runbook in the repository, by its raw address; the docs host does serve `.md`, but the guide cannot carry the runbook's shape in eight languages | 2026-11-27 |

## Test strategy summary

See [test-plan.md](test-plan.md). Shape tests, the docs checks, and a walk of the development runbook in a scratch worktree plus the self-host runbook up to its first login.
