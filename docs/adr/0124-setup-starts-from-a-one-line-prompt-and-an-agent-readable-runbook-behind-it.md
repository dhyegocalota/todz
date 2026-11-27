# 0124. Setup starts from a one-line prompt and an agent-readable runbook behind it

- Status: Accepted (the loop's call)
- Date: 2026-11-27
- Deciders: Claude (the build loop's call, under the owner's order of 2026-11-27 for a self-host and a development environment that are 100% agentic from a prompt of one or two lines)
- Inspired by: the owner's "agentic-first: quero um prompt simples, 1 ou 2 linhas, e se a pessoa quiser saber cada comando, tudo bem"

The loop's call: the root README, the self-host guide in its eight languages and the contributing guide each open with a copyable prompt of at most two lines for any coding agent, in English in every language, that points at a runbook in the repository by its raw GitHub address: `docs/runbooks/self-host-with-an-agent.md` and `docs/runbooks/set-up-for-development.md`. Each runbook is written so an agent runs it unattended, every step with a command, an expected result and an `If it fails` line, and stops only for a login, a payment, a secret or the choice of a domain. The manual commands stay behind a collapsed "Do it by hand" section. Repository-shape tests pin each prompt at the top of its file and the resolution of its address.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Make the self-host guide the runbook and point the prompt at its `.md` form on the docs site | One source, a docs address | Eight translations would need the expected results and failure lines, and the guide's tests forbid private references | The runbook is English-only and one file; the guide stays the reference |
| A prompt that names only the task | Shortest | The agent invents the steps and may deploy to the wrong place | The steps are the product of this change |
| A script that does everything | No agent judgment | Logins, payments and secrets still need a person, and a script hides each step | The owner wants an agent, with the commands visible |

## Consequences

The runbooks index says these two runbooks are run by agents for their owner, while the build loop walks the self-host one only to its first login stop. A command that changes in the guide changes in its runbook in the same commit; the shape tests catch a missing script, not a stale sentence.

## Revisit when

A `todz` command line exists that performs the setup, or the docs host serves a page as a prompt target that carries the expected results.
