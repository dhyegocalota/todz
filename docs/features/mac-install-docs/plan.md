# Plan: Mac install

**Spec:** spec.md
**Tier:** 🟢
**Seam:** the Mintlify navigation in `apps/docs/docs.json`, and the landing shell's links in `apps/api/src/site/site-shell.ts`
**Assumptions (decided, owner can override):**
- The page is `install-on-mac`, titled "Install on Mac".
- The landing links it in the header and the footer, beside the self-host guide, with a short label on narrow screens.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `docs/features/mac-install-docs/`, `docs/features/README.md`, `apps/docs/`, `apps/api/src/site/`, `apps/api/test/` | `developer` |

## Sequencing

One group, in order: red test, landing copy, the page, the discovery lists.

## Steps

### G1

- [ ] **Step 1:** the red test that the landing links the install page, committed alone.
- [ ] **Step 2:** the landing copy and shell links, green.
- [ ] **Step 3:** the docs page, its navigation entry, the Quickstart link and the sidebar e2e titles.
- [ ] **Step 4:** the page in the llms index and the WebMCP docs tool, with their tests.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | A narrow header overflows | the landing e2e at 375 | drop the header link, keep the footer |
| 3 | A broken link | `mint broken-links` | fix the href |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** screenshots and video recorded and uploaded.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
