# Plan: Security fixes

**Spec:** spec.md
**Tier:** 🟡
**Seam:** the sign-in page and the mail templates in `apps/api`, the Debug/Release URL scheme in `apps/macos`, the Cloudflare wrapper and the local gate in `scripts`
**Assumptions (decided, owner can override):**
- Item 1: the Debug scheme is `todz-dev`; the Worker's scheme is the configuration value `APP_LINK_SCHEME` (`todz` in production, `todz-dev` in the development override of ADR 0044), required, never defaulted.
- Item 5: the colour is the nearest step of the brand's own gradient `#4C6BFF` → `#1B2A9E` that gives white text ≥ 4.5:1; the mail link colour on white takes the same step. The developer computes the step in the test, not by hand.
- Item 8: ADR 0057 stands; the pin is a repository-shape test over the Focus filter's source.
- Item 10: `pnpm security:audit` reported "No known vulnerabilities found" on 2026-11-25 (run from the repository root with `--prod --audit-level=high`). No dependency changes unless the full `pnpm audit` reports a high or critical advisory.
- Item 11: the helper fills only the headers a route left out, so the admin's `no-referrer` and the sign-in page's own policy stay as they are.
- Item 12c: the waitlist cap is not built (spec Non-goals).
- Item 13: the deploy follows the merge; the run log is a follow-up `docs` PR, as `turnstile-live` did.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 Lane W (API) | `apps/api/**` (source, `test/`, `e2e/`, `scripts/emails/`, `src/emails/generated/`, `wrangler.jsonc`, `migrations/` untouched), `tools/repository-shape/src/api-source.test.ts`, `docs/runbooks/deploy-the-api.md` (step 13 only) | `developer-1` |
| G2 Lane M (macOS) | `apps/macos/**` (`project.yml`, `TodzKit/Sources`, `TodzKit/Tests`, `Todz/**`, `TodzWidgets/**`) | `developer-2` |
| G3 Lane T (scripts and tooling) | `scripts/todz-cloudflare.sh`, `scripts/todz-cloudflare.test.sh`, `scripts/verify.sh`, `scripts/verify.test.sh`, `scripts/verify-gates.tsv`, `tools/repository-shape/src/focus-filter.test.ts` (new; the rest of `tools/repository-shape/**` is untouched), `docs/learnings/2026-11-25-*.md` (new), `package.json` and `pnpm-lock.yaml` only if the audit reports | `developer-3` |
| Lead | `docs/features/security-fixes/**` (`spec.md`, `plan.md`, `test-plan.md`, `tester-briefing.md` is written by the developers), `docs/adr/0057-*.md`, `docs/adr/README.md`, `docs/features/README.md` | lead |

Developers never edit a sibling's files. A developer that needs a sibling's file stops and asks the lead.

## Sequencing

The three lanes run in parallel in their own worktrees; they share no file. Each lane commits red first, then green, on its own branch. The lead merges the three lanes into `feat/security-fixes` (by merge, never rebase), runs `pnpm verify` for the whole diff, and ships. Lane M needs `xcodegen` and Xcode; Lane T's step 15 reproduces the macOS gate on a machine with Xcode, which the developer checks with `doctor.sh` first.

## Steps

Every box is empty when authored. A developer ticks its own line and records the evidence after it.

### G1 Lane W (API)

- [ ] **Step 1:** Red, one commit. Add the failing tests for items 1b, 3, 5, 6, 7 and 11: `apps/api/test/sign-in-page.test.ts` (the production configuration answers `todz://sign-in?token=`, the development configuration answers `todz-dev://…`, a missing `APP_LINK_SCHEME` throws), `apps/api/test/email-address.test.ts` (`https://a.bc/x?@a.bc` → `null`), `apps/api/test/email-contrast.test.ts` (new: white on the button colour ≥ 4.5, the link colour on white ≥ 4.5), `apps/api/test/admin-pages.test.ts` (status element has no `hidden`, `aria-live="polite"`), `apps/api/test/site-pages.test.ts` (waitlist widget carries `data-error-callback`), `apps/api/test/security-headers.test.ts` (new: one test per header per host kind). Stub `apps/api/src/security-headers.ts` and `apps/api/src/env.ts`'s `APP_LINK_SCHEME` field so typecheck stays green and each test fails on its assertion. Confirm the failure text matches the assertion and not the stub (see test plan).
- [ ] **Step 2:** Green, item 3. `apps/api/src/email-address.ts`: `:` and `/` leave `ADDRESS_CHARACTER`. Run `email-address.test.ts`.
- [ ] **Step 3:** Pin, item 4. `apps/api/src/sign-in-limiter.ts` imports `limitRefusal` from `./site/site-limiter` and maps `SiteLimitRefusal.TryAgain` to `signInRefusal()` and `SiteLimitRefusal.Unavailable` to `errorResponse(OwnerErrorCode.SignInUnavailable)`; the local copy goes. `sign-in-limiter.test.ts` stays green unchanged: the commit says `pin`.
- [ ] **Step 4:** Green, items 6 and 7. `apps/api/src/site/admin-link-page.ts`: the status element loses `hidden` and keeps `role="status"` and `aria-live="polite"`; the retry link keeps its `hidden`. `apps/api/src/site/landing-page.ts`: `data-error-callback` on the waitlist widget, with a function that restores the ready state of the form's button (the same name pattern as `sign-in-challenge-page.ts`). Add the Playwright case in `apps/api/e2e` that blocks Turnstile and checks the button is no longer "Joining…".
- [ ] **Step 5:** Green, item 5. `apps/api/scripts/emails/email-style.ts`: the button and link colour become the chosen step; the `*.ts` files in `apps/api/scripts/emails` that name the colour follow it. Regenerate `apps/api/src/emails/generated/email-templates.ts` with the package's own generator (`apps/api/scripts/emails/cli.ts`); never hand-edit the generated file. `email-contrast.test.ts` green.
- [ ] **Step 6:** Green, item 11. `apps/api/src/security-headers.ts` (new) exports `withSecurityHeaders(response)`: it sets `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `Strict-Transport-Security` (reusing `STRICT_TRANSPORT_SECURITY` from `apps/api/src/site/site-headers.ts`), `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer` where the route left them out. `apps/api/src/index.ts` wraps the API host's answers. `site-pages.test.ts` and `security-headers.test.ts` green. If `tools/repository-shape/src/api-source.test.ts` pins anything this changes, update that pin in this step.
- [ ] **Step 7:** Green, item 1b. `apps/api/src/env.ts` types `APP_LINK_SCHEME: string` as required. `apps/api/wrangler.jsonc`: `APP_LINK_SCHEME: "todz"` in `vars` and `todz-dev` in the development override (confirm the override's name against ADR 0044 before writing). `apps/api/src/sign-in-page.ts` builds the prefix from the configured scheme and drops the literal `todz`. `sign-in-page.test.ts` green.
- [ ] **Step 8:** Runbook and lane gate. `docs/runbooks/deploy-the-api.md` step 13 gains the header curls for `https://api.todz.app/owner` and `https://todz.app/` (CSP, HSTS, nosniff, Referrer-Policy, frame-ancestors) with the expected header values; the step says the scheme is `todz` in production. Run `pnpm verify` for the lane's class (`product`).

### G2 Lane M (macOS)

- [ ] **Step 9:** Red, one commit. `apps/macos/TodzKit/Tests/TodzKitTests/SignInLinkTests.swift` (a link with the bundle's own scheme is accepted; the other build's scheme `todz`/`todz-dev` is refused) and `WidgetLinkTests` (the widget's link uses the bundle's scheme) and `DayCloseCoordinatorTests.swift` (an unengaged mode from a previous day, then `popoverShown()` → the close signal fires once and the mode ends). The bundle scheme is injected as a value into the parser so the red test does not depend on the test host's plist. Confirm each fails for its assertion.
- [ ] **Step 10:** Green, item 1a. `apps/macos/project.yml`: `CFBundleURLSchemes: [$(TODZ_URL_SCHEME)]` with `TODZ_URL_SCHEME: todz-dev` on the Debug configuration and `todz` on Release. `IncomingLink.swift`, `AppModel+SignInLink.swift`, `WidgetLink.swift` read the scheme from the bundle's `CFBundleURLSchemes` through one shared value in TodzKit; the literal `linkScheme = "todz"` goes. The widget extension gets the same build setting. Regenerate with `xcodegen generate --spec apps/macos/project.yml`.
- [ ] **Step 11:** Green, item 12a and 12b. `DayCloseCoordinator.swift` `popoverShown()` signals the close for an unengaged stale mode through the signal it already has. The workspace observer moves from `MenuBarToday.swift` (line near `closeWhenTheDayCloseAsks()`) to `MenuBarPopover.swift`; the commit says `pin` for the move, because the existing coordinator tests stay green.
- [ ] **Step 12:** Lane gate. `swift test --package-path apps/macos/TodzKit` green with its count; `xcodegen generate --spec apps/macos/project.yml`; `xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build` succeeds. Record the counts in the tester briefing.

### G3 Lane T (scripts and tooling)

- [ ] **Step 13:** Red, one commit. `scripts/todz-cloudflare.test.sh`: with a stub curl that records its argv and a stub Keychain binary, each case states the input and expects the outcome: `api GET "/zones/<id>/"` → refused `not on the allowlist`; `api GET "/zones/<id>/[a-b]"` → refused; `api GET "/zones/<id>/{a,b}"` → refused; `api GET "/zones/<id>/x"` → allowed, and the recorded argv contains `--globoff`. Confirm each fails for its assertion.
- [ ] **Step 14:** Green, item 2. `scripts/todz-cloudflare.sh`: `--globoff` in the curl flags; the path case refuses `[`, `]`, `{`, `}`; the zone case is `"/zones/$zone_id/?"*`. `scripts/todz-cloudflare.test.sh` green.
- [ ] **Step 15:** Reproduce item 9, no commit. Run `scripts/verify.sh macos` five times in a row in the lane's worktree and record each pass or failure with its last 40 log lines in the session scratchpad. Also run `swift test --package-path apps/macos/TodzKit` five times. Name the cause from the failing log: candidates are a shared `apps/macos/build` or SwiftPM `.build` between gates, a swift test timing out under load (see learning `2026-11-07-default-test-timeout-measures-the-machine-under-load.md`), `xcodebuild` derived-data contention, or a parallel test run. A cause that cannot be reproduced is recorded as such and the step stops at a learning.
- [ ] **Step 16:** Red for item 9, only if step 15 named a cause. `scripts/verify.test.sh`: a case that fails on the current gate command (for example, the command that let the flake through). Commit red.
- [ ] **Step 17:** Green for item 9, only if step 16 is red. `scripts/verify.sh` (and `scripts/verify-gates.tsv` if the gate path changes) carries the fix. `scripts/verify.test.sh` green.
- [ ] **Step 18:** Learning. `docs/learnings/2026-11-25-<slug>.md` records the signal, the cause (or "not reproduced in five runs") and the step that answered it. Uses the `learning` skill's format.
- [ ] **Step 19:** Pin, item 8. `tools/repository-shape/src/focus-filter.test.ts` (new): reads `apps/macos/Todz/FocusFilter/TodzFocusFilter.swift` and asserts it does not contain `isDiscoverable = false`. Green on arrival: commit says `pin`.
- [ ] **Step 20:** Audit, item 10. Run `pnpm audit` (full, dev dependencies too) and `pnpm security:audit` from the repository root; record the output. If a high or critical advisory appears, update the one package with the smallest change and pin the version in the test plan. Otherwise no change.
- [ ] **Step 21:** Lane gate. `pnpm verify` for the lane's class (`tooling`, with `scripts/*` and `tools/repository-shape/*`) green.

### Lead

- [ ] **Step 22:** Merge the three lanes into `feat/security-fixes` by merge; run `pnpm verify`; the lead ticks the test plan's tooling section with the gate output.

## Z. Prove and ship

- [ ] **Tester briefing:** the developers wrote their sections of `tester-briefing.md` (what changed, how to run, red today and green after, hypotheses to attack).
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` for the product items and ticked every box with evidence (including the Playwright walk of the widget's error path and the Debug/Release link check).
- [ ] **Reviewer:** a fresh `reviewer` verdict; refutation of the three riskiest claims recorded in `test-plan.md`.
- [ ] **Security reviewer:** a fresh `security-reviewer` verdict on the diff (scheme handling, headers, the limiter fold, the admin page).
- [ ] **/check-ui:** the admin link page, the waitlist widget's error state and the Settings-free Debug build are recorded (the mail colour is recorded from a rendered mail).
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened, human checklist from the spec copied into the body.
- [ ] **Deploy:** after the merge, `docs/runbooks/deploy-the-api.md` runs from `main`; step 13's curls answer as the runbook says; a follow-up `docs` PR records the run log.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 5 | The generated templates drift from the source | `email-contrast.test.ts` reads a different hex from the generated file than from `email-style.ts` | Regenerate with `apps/api/scripts/emails/cli.ts`; never edit the generated file |
| 6 | A route's own header is overwritten | `site-pages.test.ts` sees a changed `Referrer-Policy` on the admin page | The helper fills only missing headers; revert the wrap in `index.ts` |
| 7 | Production sign-in stops working when the Worker deploys without `APP_LINK_SCHEME` | `/sign-in` answers 500 in `wrangler tail`; `sign-in-page.test.ts` red on missing config | Set `APP_LINK_SCHEME` in `wrangler.jsonc` `vars` and redeploy; the page is stateless |
| 7 | The development override names the wrong scheme | The local sign-in opens the Release app | Fix the override; the Debug app is the only receiver of `todz-dev` |
| 10 | The Debug build registers `todz-dev` but the widget still builds `todz://` links | Widget taps do nothing in a Debug build; `WidgetLinkTests` red | Read the scheme from the bundle in `WidgetLink.swift` (step 10); the widget extension takes the same build setting |
| 10 | The Release app stops accepting its own links | `SignInLinkTests` red for `todz://` in the Release configuration | Restore `CFBundleURLSchemes: [todz]` for Release; the setting is per configuration |
| 11 | `xcodegen` drops the URL types | The Debug build's `Info.plist` lacks `CFBundleURLTypes` | Re-run `xcodegen generate` from `project.yml` |
| 15 | The flake is not reproduced | Five runs pass | Record "not reproduced" in the learning; do not guess a fix |
| 16 | A verify-gate change hides a real failure | A gate that used to fail passes after the change | Revert the gate change; the red case in `verify.test.sh` stays |
| Z deploy | Production deploy from `main` with a mismatched Worker and mail template | Step 13 curls answer the old headers | Runbook rollback restores the previous Worker version |

**Steps with no backout:** the production deploy in Z (`Deploy` line): the runbook's rollback restores the previous Worker version, but mail already sent in the window stays sent and a link already opened stays opened. The human checklist in the spec runs before the merge, not after.
