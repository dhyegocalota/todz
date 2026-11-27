# Contributing to todz

Thank you for helping. todz is small and moves fast, so a short conversation first saves everyone time.

To get ready to contribute, paste this into your coding agent:

```text
Set up todz for development: follow https://raw.githubusercontent.com/dhyegocalota/todz/main/docs/runbooks/set-up-for-development.md until pnpm verify is green, and stop only to ask me for logins.
```

<details>
<summary>Do it by hand</summary>

```bash
git clone https://github.com/dhyegocalota/todz.git && cd todz
bash .agents/hooks/doctor.sh
pnpm install --frozen-lockfile
pnpm verify all
```

The doctor names anything missing and the command that installs it. The gate is `pnpm verify`.

</details>

## Before you write code

- **Bugs:** open an issue with the bug template: what you did, what you expected, what happened.
- **Features and larger changes:** open an issue first and describe the problem, not only the solution. A change that touches workspace isolation, the MCP tools or sync needs agreement before code.
- **Security issues:** never in a public issue; follow [SECURITY.md](SECURITY.md).

## How work happens here

The repository has one process for people and for coding agents alike, in [.claude/HARNESS.md](../.claude/HARNESS.md). The parts that matter most for a pull request:

- **Conventions** are in [AGENTS.md](../AGENTS.md): no comments, flat `if`s and early returns, named parameters, enums over string literals, constants over magic literals, no `?? default` that hides a missing value.
- **Tests are mandatory.** Write the failing test first, then the code. Unit tests use Vitest; end-to-end tests use Playwright.
- **The local gate** is `pnpm verify`. Run it before you push; it runs what your diff can break.
- **Commits** follow Conventional Commits (`type(scope): summary`), in English. Never skip the git hooks.
- **Copy** shown to users lives in `*-copy.ts` modules.

## Licensing of contributions

The repository is under the GNU Affero General Public License v3.0. Every contribution also comes under the [Contributor License Agreement](CLA.md): you keep your copyright, and Logic Bit may relicense the project, your contribution included. Tick its box in the pull request template; a pull request without it is not merged.
