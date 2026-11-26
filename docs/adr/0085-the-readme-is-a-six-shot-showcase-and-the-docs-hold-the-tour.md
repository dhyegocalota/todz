# 0085. The README is a six-shot showcase and the docs hold the tour

- Status: Proposed
- Date: 2026-11-26
- Deciders: Dhyego Calota (owner) asked for a newcomer-first README, shorter than zapbip's, on 2026-11-26; Claude (the build loop's call on the cut and the new home)
- Inspired by: the README at c0ad1411, 28 screenshots long; [ADR 0047](0047-the-readme-walk-shows-only-the-shots-that-tell-the-product-s-story.md), whose revisit condition ("the landing on `todz.app` shows the product") has fired; [ADR 0059](0059-the-docs-are-a-mintlify-site-on-docs-todz-app-built-from-apps-docs-and-the-self-host-guide-moves-into-it.md)

## Context

A newcomer asks three things in ten seconds: what is it, does it look good, how do I try it. The README answers the first and buries the other two under 27 cells, half of them Settings rows, mails and the landing. The landing now shows the product, and the docs site exists to hold what a person reads after the first look.

## Decision

1. The README is a showcase: the logo, the promise, the badges, a hero screenshot, a two-by-two grid (Today, the menu bar with its count, a widget, Connect an Agent), `## Install` and `## Connect an agent`. It embeds at most six screenshots. Light and dark go through `<picture>` with `prefers-color-scheme` wherever both variants exist; today only the logo has both.
2. `docs/screenshots` holds what the README shows and what the landing serves as byte copies; nothing else.
3. Every other product shot lives in `apps/docs/images/<feature>/NN-<what-it-shows>.png`, within the 1 600 pixel and 1 MB limits, and is shown by a docs page, the tour (`apps/docs/tour.mdx`). A visible feature's pull request adds its shot to the tour, not to the README, unless it replaces one of the six.
4. Shots that were setup or a still of an animation (`motion`, the two mails) and pictures of the landing are deleted; git history and the pull requests keep them.
5. `tools/repository-shape/src/product-screenshots.test.ts` pins it: every screenshot is shown by the README or served by the landing, the README holds at most six, the hero sits above `## Install`, every `<picture>` source exists, and every docs image is a numbered PNG in a feature-named folder shown by a docs page.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Hero, four cells and a tour in the docs (chosen) | a newcomer sees the product, then installs; nothing is lost | the tour is a second place to update | the owner's ask |
| Keep the walk, shorten it to a dozen | one place | still a wall of cells before the install | the same problem at half the size |
| Delete every shot the README drops | smallest repository | the Settings and widget shots have no home | the docs tour wants them |
| Animated hero now | shows the agent adding a task | none exists to commit | on the v1.1 list |

## Consequences

- ADR 0047 is superseded; ADR 0030 is amended on §3 (a hero and four cells, not a walk), §4 (new shots go to the docs tour) and §6 (a screenshot is shown by the README, the landing or a docs page).
- `docs/screenshots` loses fourteen files to `apps/docs/images` and five to deletion.
- The `connect-an-agent` shot still shows `http://localhost:8787/mcp`; a reshoot against `https://api.todz.app/mcp` follows.

## Evidence

`tools/repository-shape/src/product-screenshots.test.ts`.

## Revisit when

A hero animation exists, or the dark captures of the four grid shots do, and each cell can be wrapped in `<picture>`.
