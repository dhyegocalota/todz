# Architecture Decision Records

An ADR records one architecturally significant decision: the context that forced it, the option chosen, the options rejected and why, and the conditions under which it should be reopened. ADRs are short, immutable once accepted, and written from [`_template.md`](_template.md).

## Numbering

- File name: `NNNN-kebab-slug.md`, four digits, assigned in order of creation.
- Numbers are never reused and never renumbered.
- The index lists every record in number order, with the title, status and date the record states; `tools/repository-shape/src/document-indexes.test.ts` checks it.
- A decision is changed by writing a new ADR and marking the old one `Superseded by [NNNN](NNNN-slug.md)`. The old file stays in place.

## Status lifecycle

- `Proposed`: written, not yet confirmed by the owner or pending a spike.
- `Accepted`: confirmed; the code follows it.
- `Superseded by [NNNN](NNNN-slug.md)`: replaced; kept for history.

A `Proposed` ADR moves to `Accepted` by editing its status line and date. Any other change of substance requires a new ADR.

## Index

| Number | Title | Status | Date |
|--------|-------|--------|------|
| [0001](0001-one-source-per-agent-surface.md) | One source per agent surface, a thin adapter per tool | Accepted | 2026-11-23 |
| [0002](0002-mechanical-security-gates-and-a-security-reviewer.md) | Mechanical security gates and a dedicated security reviewer before every PR | Accepted | 2026-11-23 |
| [0003](0003-agentic-scenario-runs-with-one-browser-per-user.md) | Agentic scenario runs with one Playwright MCP server per user | Accepted | 2026-11-23 |
| [0004](0004-the-agent-repairs-its-own-machine-doctor-reports-never-installs.md) | The agent repairs its own machine: a doctor reports at session start and never installs | Accepted | 2026-11-23 |
| [0005](0005-the-local-gate-runs-what-the-diff-can-break.md) | The local gate runs what the diff can break | Accepted | 2026-11-23 |
| [0006](0006-pull-request-media-is-attached-with-the-github-cli.md) | Pull request media is attached with the GitHub CLI | Accepted | 2026-11-23 |
| [0007](0007-contributions-come-under-a-contributor-license-agreement.md) | Contributions come under a contributor license agreement | Accepted | 2026-11-23 |
| [0008](0008-runbooks-live-in-the-repository.md) | Runbooks live in the repository | Accepted | 2026-11-23 |
| [0009](0009-manual-order-uses-fractional-keys.md) | Manual order uses fractional keys | Proposed | 2026-11-23 |
| [0010](0010-the-task-rules-run-behind-synchronous-ports.md) | The task rules run behind synchronous ports | Proposed | 2026-11-23 |
| [0011](0011-due-dates-are-calendar-dates-and-the-caller-names-today.md) | Due dates are calendar dates and the caller names today | Proposed | 2026-11-23 |
| [0012](0012-worker-tests-run-inside-workerd.md) | Worker tests run inside workerd | Proposed | 2026-11-23 |
| [0013](0013-a-project-is-reached-only-through-the-directory.md) | A project is reached only through the directory | Proposed | 2026-11-23 |
| [0014](0014-credentials-are-stored-as-sha-256-digests.md) | Credentials are stored as SHA-256 digests | Proposed | 2026-11-23 |
| [0015](0015-the-project-store-answers-with-results-not-thrown-errors.md) | The project store answers with results, not thrown errors | Proposed | 2026-11-23 |
