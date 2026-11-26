# Open source surfaces

**Status:** Shipped 2026-11-26
**Tier:** 🟡
**Owner approval:** approved 2026-11-26 by the owner's words to the loop ("cadê na landing page o stars, coisas de open source igual zapbip? também quero star no GitHub no app, nos options do menu bar etc"), inheriting the product scope of [docs/product/README.md](../../product/README.md)
**ADRs:** [0081](../../adr/0081-the-whole-repository-is-agpl-3-0-only-and-going-public-follows-a-pre-flight-runbook.md); no new record, the choices below have no rejected alternative worth one
**Not changing:** the license, the governance files, the download, the deploys, the Content-Security-Policy's strictness

## Problem

The repository is public under AGPL-3.0-only, and nothing on the landing or in the app says so or invites a star.

## Goals

- The landing shows a glass pill with the GitHub mark, a star glyph and the live star count abbreviated (`1.2k`), labelled "Star on GitHub", in the hero beside Download for Mac and in the footer. The number is rendered by the server from a cached count, counts up once when the pill scrolls into view in at most 600 ms with an ease-out, stays static under `prefers-reduced-motion`, glows mint on hover, works in light and dark, and reserves its final width so nothing shifts.
- When GitHub fails the pill reads "Star on GitHub" with no number.
- The hero says "Open source · AGPL-3.0" linking the repository; the footer links the license and the contributing guide.
- The SoftwareApplication JSON-LD carries `codeRepository` and `license`; llms.txt and llms-full.txt name the repository and the license.
- The app offers "Star todz on GitHub" in the popover's footer and the todz menu, and an "Open source on GitHub" link in Settings; each opens the repository with `NSWorkspace`.
- The README carries a GitHub stars badge next to the license badge.

## Non-goals

- Authenticated GitHub calls, a star button that stars from the page, or any count outside the landing.
- A new menu in the popover: its footer row is its options area.

## Design

### Data flow

`GET /` reads the count from the Cache API (`repository-stars`), falling back to one GitHub API call with a two second timeout, caches a count for an hour and a failure for five minutes, and renders the page with the abbreviated count in the markup. The count-up is one more inline script the existing policy allows by hash, so the policy gains no source. `REPOSITORY_API_ORIGIN` is an optional variable only the end-to-end run sets, to point the Worker at a fake GitHub.

### Interfaces

The repository address, its license and its contributing guide live once in `libs/types` (`REPOSITORY`, next to `COMPANY`). TodzKit's `RepositoryAddress.text` is pinned to it by `tools/repository-shape/src/open-source-surfaces.test.ts`.

### Failure handling

A network error, a non-OK status or a body that is not a non-negative integer yields no number and no new request for five minutes; the page still answers 200.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Star count design | plain link, or a glass pill that counts up | A glass pill, "bem sexy", counting up once, static under reduced motion, mint glow on hover | 2026-11-26 |
| Where the popover offers the star | a new menu, or its footer row | The footer row beside Check for Updates…, since the popover has no options menu | 2026-11-26 |

## Test strategy summary

Vitest pins the stars fetch, cache and fail-soft path, the pill, the open source line, the JSON-LD, llms.txt and the unchanged policy; Playwright pins the number, its absence on failure, the unchanged width and reduced motion; Swift Testing pins the address; repository-shape pins the badge and the address against `libs/types`.
