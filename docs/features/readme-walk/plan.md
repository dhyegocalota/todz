# Plan: README walk

**Spec:** spec.md
**Tier:** 🟢
**Seam:** the root `README.md` walk section and `docs/screenshots/`
**Assumptions (decided, owner can override):**
- The twelve cells of ADR 0047, in its order.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| Lead | `README.md`, `docs/screenshots/**`, `docs/adr/0047-*.md`, the two indexes | the lead (a two-file docs change) |

## Sequencing

One commit; no product code.

## Steps

- [x] **Step 1:** Cut the walk table to the twelve cells and delete the eleven dropped PNGs — evidence: 415b068.
- [x] **Step 2:** ADR 0047 amends ADR 0030 §1; the ADR and feature indexes gain their rows — evidence: 415b068.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | a kept cell points at a deleted file, or a kept file is no longer shown | `product-screenshots.test.ts` or the README link check fails | restore the file from `origin/main` |

**Steps with no backout:** none; git keeps every deleted shot.

## Z. Prove and ship

- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md`.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/open-pr:** gates passed, PR opened.
