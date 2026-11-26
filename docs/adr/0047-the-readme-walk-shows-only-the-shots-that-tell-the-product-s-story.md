# 0047. The README walk shows only the shots that tell the product's story

- Status: Superseded by [0085](0085-the-readme-is-a-six-shot-showcase-and-the-docs-hold-the-tour.md); was Proposed and amends [0030](0030-product-screenshots-live-in-docs-screenshots-and-the-readme-walks-them.md) §§1, 3, 4 and supersedes the README clause of [0039](0039-the-app-icon-is-a-layered-icon-composer-document-with-the-flat-set-as-its-fallback.md) (brand surfaces in light and dark, the icon's looks)
- Date: 2026-11-24
- Deciders: Dhyego Calota (owner) asked for it on 2026-11-24 ("deixa só os screenshots que fazem sentido no readme"); Claude (the build loop's call on the cut)
- Inspired by: the README walk at 3d0e27e, 25 cells long

## Context

ADR 0030 gives every feature the owner can see its own screenshots in `docs/screenshots/<feature>/` (§1), and the README walks all of them (§§3, 4). ADR 0039 added each brand surface in dark and the icon's six looks. After sixteen features the walk mixes the product with its setup (sign-in, naming the first workspace), its error states (a refused change, offline, an incomplete link), and light/dark pairs that add nothing. The owner wants only the shots that make sense.

## Decision

1. The README walk shows the product's story, in this order:
   - Today across projects;
   - an agent's task appearing live;
   - the menu bar popover and its count;
   - the four widgets;
   - Connect an agent;
   - an agent's tasks in a project;
   - the sign-in and welcome mails.

   The hero stays above the walk.
2. A feature whose screens are setup, error states or a variant of a shot already shown keeps no committed screenshot; its pull request carries its media (ADR 0006).
3. A later feature that changes a shown screen replaces that shot in place; one that adds a screen worth the story adds a cell, and the README stays within about a dozen cells.
4. Every committed PNG is still shown, so a dropped shot is deleted (`product-screenshots.test.ts`).

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep a short story, delete the rest (chosen) | the README reads as a product page | some features have no committed shot | the owner's ask |
| Move the rest under a collapsed section | nothing lost | still in the repository and the page | "only the ones that make sense" |
| Keep every shot in the repository, unshown | history in one place | breaks the "every PNG shown" check | the pull requests already hold the media |

## Consequences

- `docs/screenshots/` loses the setup, error and variant shots of `mac-app-shell`, `mac-sync`, `brand-glass`, `magic-link-sign-in` and `transactional-email`; git history keeps them.
- The owner's earlier rule for the build loop, "every visible feature ships screenshots in the README", now means: a new screen in the story replaces or adds its cell.

## Revisit when

The landing on `todz.app` shows the product, and the README can point there.
