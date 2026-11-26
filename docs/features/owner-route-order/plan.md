# Plan: Owner route order

**Spec:** spec.md
**Tier:** 🟡
**Seam:** `serveOwner` and `servePublic` in `apps/api/src/owner-endpoint.ts`
**Assumptions (decided, owner can override):**
- A known credential with an old app still gets 426 before the owner limiter spends budget.
- Item 3 needs no change: it shipped in PR #84.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/src/owner-endpoint.ts`, `apps/api/test/app-version-gate.test.ts`, `apps/api/test/download-paths.test.ts` | lane lead, inline |
| G2 | `docs/features/owner-route-order/`, `docs/features/README.md`, `docs/adr/0086-*`, `docs/adr/README.md` | lane lead, inline |

## Sequencing

G1 then G2.

## Steps

### G1

- [x] **Step 1:** Red: the 401-before-426 tests, committed alone (43f7aff0).
- [x] **Step 2:** Green: the version gate moves after the credential for session routes and stays first for public routes.
- [x] **Step 3:** Pin: the odd download paths never answer 5xx.

### G2

- [x] **Step 4:** Feature folder, ADR 0086 and both index rows.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | An old app with a valid key is no longer refused | `app-version-gate.test.ts` signed-in and socket cases | revert the commit and deploy |
| 2 | A public route stops refusing an old app | the sign-in method and pre-ADR 0058 sign-in link cases | revert the commit and deploy |

**Steps with no backout:** none
