# Plan: Credits

**Spec:** spec.md
**Tier:** 🟢
**Seam:** the `COMPANY` constant in `libs/types`, the site shell's footer in `apps/api/src/site/`, and the root `README.md`
**Assumptions (decided, owner can override):**
- The credit sits in the footer between the copyright and the guide link, and links the website in the same tab.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `libs/types/src/`, `apps/api/src/site/`, `apps/api/test/site-pages.test.ts`, `apps/api/e2e/landing.spec.ts`, `tools/repository-shape/src/company-credit.test.ts`, `README.md` | `developer` |

## Sequencing

One developer, red tests first, then the constant, the footer and the README line.

## Steps

### G1

- [x] **Step 1:** Failing tests: the `COMPANY` constants test, the footer credit unit test, the landing end-to-end credit and keyboard checks, the README line shape test — evidence: 694efeb.
- [x] **Step 2:** `COMPANY` in `libs/types`, the copy in `landing-copy.ts`, the footer line in `site-shell.ts`, its style, the README line — evidence: 49f0a2a.
- [x] **Step 3:** `pnpm verify` green; the tester briefing written — evidence: verify 8 gates green on the working tree of 49f0a2a; briefing in `tester-briefing.md`.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | the footer overflows at 375 or the link has no focus ring | the landing end-to-end keyboard or layout check fails | revert the style rule |
| 2 | a word in the footer is not in the copy module | the "every word comes from the copy module" unit test fails | move the string into `landing-copy.ts` |
| 2 | the README line drifts from `COMPANY` | the shape test fails | edit the line |

**Steps with no backout:** none.

## Z. Prove and ship

- [x] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** screenshots of the footer, light and dark, recorded and uploaded.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
