# 0006. Pull request media is attached with the GitHub CLI

- Status: Accepted
- Date: 2026-11-23
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's words that screenshots and videos must be embedded straight in the pull request, never kept in a second place; GitHub CLI 2.99.0, which added `--attach` to `gh pr create`, `gh pr edit` and `gh pr comment`

## Context

Every pull request that touches UI carries screenshots and a walkthrough video. Hosting them in GitHub Releases or in a separate media repository puts product evidence in a second place that outlives the pull request, needs its own access and cleanup, and shows up in the repository's releases, deployments or commit history. GitHub already stores files dropped into a pull request under `https://github.com/user-attachments/`, with the access of the repository they were added to. GitHub CLI 2.99.0 uploads to that storage with `gh pr edit <number> --attach <file>`, using the token `gh` already holds, on any machine, with no browser.

## Decision

`scripts/pr-media.sh <pull request> <files>` runs one `gh pr edit --attach` for all the files and prints the lines GitHub added to the body. The recorder and `/check-ui` embed those lines in the pull request body. No media is pushed to a repository, a release or a deployment. `doctor.sh` requires a `gh` of 2.99.0 or newer.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| `gh pr edit --attach` (chosen) | Headless, uses the token `gh` holds, media lives in the pull request | Needs `gh` 2.99.0 or newer | — |
| A signed-in browser driven by computer use | Needs no new `gh` | Visible window, a signed-in browser, slow and fragile | `gh` does the same upload headless |
| `gh pr comment --attach` | Leaves the body alone | Media lands in a comment, not the body | The body is where the visual explainer lives |
| Releases or a media repository | Work headless | A second store outside the pull request | Media must live in the pull request itself |

## Consequences

Any machine with an authenticated `gh` of 2.99.0 or newer attaches media, including agents running unattended. Files are limited by GitHub's attachment limit, so walkthroughs stay short or scaled. `gh pr edit` appends the media to the body when it does not already reference the file.

## Evidence

`scripts/pr-media.test.sh` drives the script with a fake `gh`; `tools/repository-shape/src/pr-media-flow.test.ts` pins that the harness files name the script, attach through `user-attachments` and never upload to a release.

## Revisit when

GitHub changes the attachment limits, or `gh` drops `--attach`.
