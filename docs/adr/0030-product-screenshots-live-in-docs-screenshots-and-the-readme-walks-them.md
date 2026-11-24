# 0030. Product screenshots live in docs/screenshots, and the README walks them

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: the owner's words of 2026-11-24, "take screenshots and put them in the README to make everything easier"; [ADR 0006](0006-pull-request-media-is-attached-with-the-github-cli.md); [ADR 0026](0026-a-native-app-is-walked-with-computer-use-and-recorded-from-its-screenshots.md)

## Context

ADR 0006 keeps pull request media out of the repository: walks, videos and evidence are attached to the pull request itself. The owner now also wants the root README to show the product, screen by screen, with screenshots of the real build. Those are not evidence of one change; they are documentation that must stay true as the product grows, so they need a home in the repository, a fixed shape, and a check that keeps the README and the files in agreement.

## Decision

1. Each feature the owner can see keeps its screenshots in `docs/screenshots/<feature-slug>/NN-<what-it-shows>.png`, numbered in the order the README shows them. They are taken from the real build by the tester's walk (ADR 0026), of the window only, in the light appearance, with fictional but plausible content.
2. A screenshot is at most 1 600 pixels wide and 1 MB. Larger captures are scaled down before they are committed.
3. The root `README.md` shows a hero screenshot of the main window under its title, then one compact gallery, `## A walk through todz`, a two-column table of the other screenshots in the order of delivery, each with a caption of a few words. The menu bar, the widgets, the key screen and an agent's MCP session join the gallery as their features ship.
4. A feature that changes a screen replaces that screenshot in the same pull request. A pull request that ships a visible feature adds its cells to the gallery. A visible feature shipped without screenshots gets them in the next pull request that touches the README.
5. ADR 0006 stands for everything else: walks, videos, before-and-after pairs and test evidence are attached to the pull request and never committed. The pull request body also embeds the new README screenshots, by their repository paths.
6. `tools/repository-shape` checks that every file under `docs/screenshots` is a PNG within the limits and is shown by the root README, and the existing link checks fail on a README image that does not exist.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| `docs/screenshots/<feature>/` in the repository (chosen) | Versioned with the code it shows; reviewed in the diff; the link checks already cover it | Grows the repository by a few MB over v1 | — |
| `user-attachments` links in the README | Nothing binary in git | The images live in a pull request, not with the code; a README in a fork or offline shows nothing | The owner asked for screenshots committed in the repository |
| Git LFS | Keeps the history small | Needs LFS installed and quota; the loop installs nothing | A handful of scaled PNGs does not need it |
| One folder of screenshots for the whole product | Simple | No owner per feature, so a stale screenshot has no feature to blame | Per-feature folders make "replace it in the same pull request" checkable |

## Consequences

The README shows the product as it is on `main`. Each visible feature's pull request carries its screenshots in the diff, so the reviewer sees them. The repository grows by roughly 0.3 to 1 MB per visible feature. A screenshot can still go stale when a later feature changes a screen without replacing it; rule 4 and the reviewer catch that, not a test.

## Evidence

`tools/repository-shape/src/product-screenshots.test.ts` pins rules 2 and 6.

## Revisit when

The repository becomes public and its size matters, the app gains a dark-mode-first look, or screenshots start to go stale faster than features replace them.
