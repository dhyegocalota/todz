# 0081. The whole repository is AGPL-3.0-only, and going public follows a pre-flight runbook

- Status: Accepted
- Date: 2026-11-26
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's words of 2026-11-26 ("also make it open source please!! siga todas as boas diretrizes de um open-source igual ao zapbip"); [ADR 0007](0007-contributions-come-under-a-contributor-license-agreement.md); zapbip's ADRs 0055 and 0061

## Context

The repository has carried the AGPL-3.0, a contributor license agreement, contributing and security files and issue templates since the scaffold, while it stayed private. The owner now wants it public in the manner of zapbip, which splits its licenses: AGPL-3.0 for the server, the site and the libraries, MIT for the client packages that other people embed.

## Decision

1. **One license, AGPL-3.0-only, for every path.** `apps/api`, `apps/docs`, `libs/*`, `tools/*` and `apps/macos` stay under the root `LICENSE`, and the root `package.json` says `AGPL-3.0-only`. todz has no client package that other projects embed: the one client, the Mac app, is distributed as an app and talks to the server through its public contract, so an MIT carve-out would only let a closed rebrand of the app, with nothing returned to anyone. Contributions come under the agreement of [ADR 0007](0007-contributions-come-under-a-contributor-license-agreement.md), which lets Logic Bit relicense later, a client package included.
2. **The governance files are the zapbip set, adapted:** `.github/CLA.md` (licensee Logic Bit AI Software Boutique Ltda, the legal name that `COMPANY` in `libs/types` holds once and the shape test reads from there), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` (GitHub's private vulnerability reporting and `security@todz.app`), `CODEOWNERS`, `pull_request_template.md` with the agreement's checkbox, and `ISSUE_TEMPLATE/` with a bug report, a feature request and a configuration linking `https://docs.todz.app` and the private advisory form. The README carries the license, docs and download badges, a Community list and a License section.
3. **Going public follows `docs/runbooks/open-source.md`.** A read-only pre-flight runs first and its results are recorded in the run log: gitleaks over every commit of every ref, a grep of the whole history for personal data, tokens, keys, private addresses and copies of the build loop's files, the author and committer addresses, `pnpm security:audit`, and a search for any dotenv file other than the example. The Cloudflare account identifier and the Turnstile site key in `apps/api/wrangler.jsonc` are public identifiers by design, so they are no finding. Anything sensitive found stops the flip: rewriting history is the owner's call, never an agent's. The runbook then lists the steps after the flip: private vulnerability reporting, secret scanning with push protection, Dependabot alerts, branch protection on `main`, the topics and the description.
4. **`security@todz.app` is an Email Routing rule in the `todz.app` zone that forwards like `hello@`.** The destination address is the owner's and never enters the repository.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Split like zapbip: MIT for the Mac app | The app is freely reusable | No package is embedded by others; a closed rebrand of the app becomes legal | Nothing to gain for the project |
| Source-available license now | Keeps competitors out | Not open source; the owner asked for open source | The CLA keeps this door open |
| Apache-2.0 or MIT everywhere | Most permissive | A hosted copy of the server could stay closed | The server is the product |
| Rewrite history to the noreply address before the flip | No personal address in the history | Changes every commit hash, including the tags `mac-v0.2.0` and `mac-v0.2.1` | The owner decided on 2026-11-26 to keep it as is |

## Consequences

The author address of every commit is public with the history. Future commits can use the GitHub noreply address. The repository's visibility is flipped by hand after the pre-flight pull request merges, and branch protection becomes possible only then.

## Evidence

`tools/repository-shape/src/open-source.test.ts` pins the license, the governance files, the agreement's checkbox, the README links and badges, the security address, the issue configuration, this record and the runbook's run log. The pre-flight results are in the run log of `docs/runbooks/open-source.md`.

## Revisit when

A client package is meant to be embedded by other projects, counsel reviews the agreement, or the owner picks another license.
