# Plan: Self-host docs

**Spec:** spec.md
**Tier:** 🟢
**Seam:** the root `README.md` and a new repository-shape test
**Assumptions (decided, owner can override):**
- The commands are plain `wrangler` for a self-hoster's own login, not the owner's Keychain wrapper.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| Lead | `docs/self-host.md`, `README.md`, `tools/repository-shape/src/self-host.test.ts`, ADR 0048 and the indexes | the lead (docs and one shape test) |

## Sequencing

Red test with the guide, then the README link.

## Steps

- [x] **Step 1:** Red: `self-host.test.ts` and `docs/self-host.md`; "the root README links it" fails — evidence: 07423ae, 1 failed and 7 passed.
- [x] **Step 2:** Green: the root README links the guide — evidence: the next commit.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | a command in the guide drifts from the repository | `self-host.test.ts` fails | fix the guide |

**Steps with no backout:** none.

## Z. Prove and ship

- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md`.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/open-pr:** gates passed, PR opened.
