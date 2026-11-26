# Plan: The final panel of todz.app

**Spec:** spec.md
**Design:** design.md (Option A)
**Tier:** 🟢
**Seam:** `finalCallHtml`, `waysHtml` and `signatureHtml` in `apps/api/src/site/landing-page.ts`, fed by `LANDING_COPY.ways` and `LANDING_COPY.signature`; the panel's rules in `SITE_STYLE`.
**Assumptions (decided, owner can override):**
- The `--glow-mint` token is defined once on `:root` and is the same in both schemes (ADR 0096).
- The terminal reuses `.terminal`, `.terminal-bar`, `.terminal-dot`, `.terminal-body`, `.terminal-line`, `.terminal-prompt`, `.terminal-command`, `.terminal-word` and `.terminal-result` as they are, overriding only inside `.way-terminal`.
- The command is the real `server:deploy` script in `apps/api/package.json`, and the test reads that manifest.
- No new inline script: the swash is an SVG with presentation attributes and a CSS animation, so the CSP hashes stay as they are.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/test/free-hero.test.ts` (red) | lane lead |
| G2 | `apps/api/src/site/landing-copy.ts`, `apps/api/src/site/landing-page.ts`, `apps/api/src/site/site-glyphs.ts`, `apps/api/src/site/site-style.ts` | lane lead |
| G3 | `docs/adr/0096-…md`, `docs/adr/README.md`, `docs/features/README.md`, `docs/features/landing-final-panel/` | lane lead |

## Sequencing

G1 is committed first and fails. G2 turns it green. G3 is docs and rides with the code. One lane, so no parallel developers.

## Steps

### G1

- [ ] **Step 1:** `free-hero.test.ts`: the ways describe pins the cloud card (three points, `/download` with `download`, `download.note` and `DOCS_INSTALL_URL` inside it, `way-badge-free`), the self-host card (body, terminal command equal to `pnpm --filter @todz/api ${script}` for a `server:deploy` key in `apps/api/package.json`, the guide link, `starPillHtml` for `null`, `0`, `42`, `1234`), the grid `7fr 5fr` from `64rem`, no `final-icon`, the signature markup with `Dhyego Calota` and `https://dhyegocalota.com.br` inside `.signature.glass` with `.signature-swash`, `--glow-mint` on `:root`. Commit red.

### G2

- [ ] **Step 2:** `landing-copy.ts`: `ways.cloud.body` becomes `points`; `ways.selfHost.terminal` added.
- [ ] **Step 3:** `site-glyphs.ts`: `SIGNATURE_SWASH`.
- [ ] **Step 4:** `landing-page.ts`: `waysHtml`, `signatureHtml`, `finalCallHtml` (no icon), `LINK_ARROW`.
- [ ] **Step 5:** `site-style.ts`: the panel's rules per design §7, `--glow-mint`, the motion and forced-colors additions, deletion of `.final-icon`, `.way-cta-secondary`, `.signature::before`, the 2-column rule.

### G3

- [ ] **Step 6:** ADR 0096 and its index row; feature row in `docs/features/README.md`.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 4 | A `null` star count drops the pill | `free-hero` pill test for `null` | revert `waysHtml` to the last green commit |
| 5 | `.way-terminal` loses to `.terminal` | the terminal keeps the 20 px radius in the tester's screenshot | move the rule below `.terminal` |
| 5 | The swash animation runs under reduced motion | the `no-preference` block check in the test | move the swash rule back inside the block |
| 2 | The first name appears alone | `tools/repository-shape/src/owner-name.test.ts` | the signature uses `AUTHOR.name` only |
