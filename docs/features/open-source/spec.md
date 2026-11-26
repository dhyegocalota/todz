# Open source

**Status:** Building
**Tier:** 🔴
**Owner approval:** approved 2026-11-26 by the owner's words to the loop ("also make it open source please!! siga todas as boas diretrizes de um open-source igual ao zapbip")
**ADRs:** [0081](../../adr/0081-the-whole-repository-is-agpl-3-0-only-and-going-public-follows-a-pre-flight-runbook.md), [0007](../../adr/0007-contributions-come-under-a-contributor-license-agreement.md)
**Not changing:** the Mintlify docs, the download, the deploys, the license text, the contributor agreement's grants

## Problem

The repository is private. The owner wants it public in the manner of zapbip, which means the governance files, a recorded pre-flight over the whole history and the settings only a public repository allows.

## Goals

- The governance files are complete and true to this repository: license, agreement, contributing, code of conduct, security policy with `security@todz.app`, code owners, pull request template with the agreement's box, issue templates linking the docs and the security form.
- The README carries the license, docs and download badges and its Community and License sections.
- `docs/runbooks/open-source.md` holds the pre-flight, run read-only with its results in the run log, and the steps after the flip.

## Non-goals

- Flipping the visibility, changing a repository setting or calling Cloudflare: todz-6f and the lead do it, step by step, from the runbook.
- Rewriting history: the owner decided on 2026-11-26 to keep the commit author address as it is.

## Design

### Data flow

The pre-flight reads the history and writes only the run log. The repository-shape tests read the governance files, the README, the ADR and the runbook.

### Failure handling

A finding in steps 1 to 8 of the runbook stops the flip; the log records its kind and commits, never its value.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| License split | AGPL-3.0 everywhere, or MIT for the Mac app | The loop's call: AGPL-3.0 everywhere (ADR 0081) | 2026-11-26 |
| Commit author address | Rewrite history, or keep | Keep, no rewrite | 2026-11-26 |

## Test strategy summary

`tools/repository-shape/src/open-source.test.ts` pins the files, the badges, the address and the run log.
