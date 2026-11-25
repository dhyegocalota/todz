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

- [x] **Tester run:** 6 of 6 at 8a06309, no defect — evidence: 8502722.
- [x] **Reviewer:** WITH RESERVATIONS: the ADR trail. ADR 0030 and ADR 0039 now point to ADR 0047, and ADR 0047 names the sections it amends. Security CLEAR, with one MINOR left as is: the mail shot's placeholder token, which reads as a preview string.
- [x] **/open-pr:** gates passed, PR opened.
