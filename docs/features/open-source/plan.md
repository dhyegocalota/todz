# Plan: Open source

**Spec:** spec.md
**Tier:** 🔴
**Seam:** the repository-shape tests and the runbooks
**Assumptions (decided, owner can override):**
- AGPL-3.0 stays the one license; no MIT carve-out for the Mac app.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `.github/`, `README.md`, `docs/adr/0081-*`, `docs/adr/README.md`, `docs/runbooks/open-source.md`, `docs/runbooks/README.md`, `docs/features/open-source/`, `docs/features/README.md`, `tools/repository-shape/src/open-source.test.ts`, `tools/repository-shape/src/runbooks.test.ts` | `developer` |

## Sequencing

One lane, test first.

## Steps

### G1

- [ ] **Step 1:** the failing shape tests for the address, the badges, the issue configuration, the ADR and the runbook.
- [ ] **Step 2:** the governance edits, the ADR and the runbook with the pre-flight run.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | A link in a runbook or an index row is wrong | `runbooks.test.ts` or `document-indexes.test.ts` fails | Fix the link or the row |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
