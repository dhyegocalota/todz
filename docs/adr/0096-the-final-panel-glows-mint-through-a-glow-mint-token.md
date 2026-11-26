# 0096. The final panel glows mint through a `--glow-mint` token

- Status: Accepted
- Date: 2026-11-26
- Deciders: Claude (the build loop's call on the panel layout and the token); Dhyego Calota (owner) may overturn it
- Inspired by: [`docs/features/landing-final-panel/design.md`](../features/landing-final-panel/design.md) Option A, and the mint ring of `.star-pill:hover` in `apps/api/src/site/site-style.ts`

## Context

The final panel of `todz.app` gives the primary cloud card a static mint halo, the same mint ring that `.star-pill:hover` writes inline today, wider and softer for a large surface. Writing that shadow inline on one card would fork the glow the page already uses.

## Decision

1. `--glow-mint` is a token on `:root`: `0 0 0 1px rgb(140 247 208 / 0.6), 0 0 40px rgb(140 247 208 / 0.35)`. It is the same in light and dark, because the mint ring reads on both wallpapers.
2. Only the primary card of the final panel uses it. The star pill keeps its inline `:hover` ring.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| A `--glow-mint` token (chosen) | one named glow for future surfaces; the same halo as the pill's hover | one more token | — |
| The shadow written inline on `.way-card-cloud` | no new token | a second copy of the mint ring beside the pill's | the page's glow would be spelled twice |
| No glow, hierarchy by width and padding only | the smallest change | the primary card is less distinct from three metres | the design's brief is that cloud reads first |

## Consequences

- The token is available to any later surface that wants the mint halo, and the design doc names it.
- If the owner declines it, the developer writes the shadow inline on `.way-card-cloud` and this record is superseded.

## Revisit when

- The owner overturns the glow, or the panel's hierarchy is judged by the tester to fail without it.
