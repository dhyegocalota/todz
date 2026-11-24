# Plan: The widgets share the App Group

**Spec:** spec.md
**Tier:** 🟡
**Seam:** `SharedFolder.of(bundle:)`, the one place both targets turn their Info.plist into the shared folder
**Assumptions (decided, owner can override):**
- The group is `$(TeamIdentifierPrefix)dev.todz`, which the Personal Team `XFWR794VS8` expands to `XFWR794VS8.dev.todz` (ADR 0035).
- A team-prefixed group signed with that team needs no provisioning profile on macOS and raises no consent prompt (ADR 0035 → Evidence).

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/macos/TodzKit/Sources/TodzKit/SharedFolder.swift`, `apps/macos/TodzKit/Tests/TodzKitTests/SharedFolderTests.swift`, `apps/macos/project.yml`, `apps/macos/Todz/Info.plist`, `apps/macos/TodzWidgets/Info.plist`, `apps/macos/Todz/Todz.entitlements`, `apps/macos/TodzWidgets/TodzWidgets.entitlements`, `apps/macos/README.md`, `apps/macos/Copy/WidgetSampleCopy.swift` | `developer` |

## Sequencing

One group: the change is one helper, its tests and the build settings.

## Steps

### G1

- [x] **Step 1 (red 03bac5f, pin 8da29cf):** Red: `SharedFolderTests` for `SharedFolder.of(info:container:)`: the key `TodzAppGroup` names the group passed to `container` and its answer is returned; a missing key, a non-text key and an empty key return `nil` without calling `container`; a `container` answering `nil` returns `nil`. The tests of the home-relative path and `accountHome` go. Commit the failing tests alone with a stub that throws `of(info:container:) is not implemented`.
- [x] **Step 2 (ed4b774):** Green: `SharedFolder.of(info:container:)` and `of(bundle:)` through `FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:)`; remove `of(info:home:)` and `accountHome`; move the `// NB ADR` pointer to ADR 0035.
- [x] **Step 3 (ed4b774, build succeeded, codesign output in the briefing):** `project.yml`: both targets get `DEVELOPMENT_TEAM: XFWR794VS8` and `CODE_SIGN_IDENTITY: Apple Development`; the entitlements swap the temporary exception for `com.apple.security.application-groups: [$(TeamIdentifierPrefix)dev.todz]`; the Info.plist key `TodzSharedFolder` becomes `TodzAppGroup: $(TeamIdentifierPrefix)dev.todz` in both. Regenerate and build with `-derivedDataPath` in the scratchpad; `codesign -d --entitlements - --xml` on the app and on the extension shows the group and no exception; `codesign -dv` shows `TeamIdentifier=XFWR794VS8` on both.
- [x] **Step 4 (the docs commit):** Docs: the app's README says the widgets read the App Group container and that builds sign with the owner's Personal Team; the sample copy no longer names a done move. Tester briefing.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 3 | Signing needs a provisioning profile after all | `xcodebuild` fails with "requires a provisioning profile" | Revert `project.yml`; ADR 0033's folder stays |
| 3 | The sandbox prompts for the group container | The hidden launch hangs and Orca finds the alert in `com.apple.UserNotificationCenter` | Answer "Don't Allow", revert, record a learning |
| 2 | The extension gets no container | The extension's store is `nil`, widgets stay empty while the snapshot exists in the group | Revert the branch; the folder build still works |
| 3 | The `macos` gate fails on a Mac without the owner's identity | `xcodebuild` prints "No signing certificate \"Mac Development\" found" or "No certificate for team" | Accepted (ADR 0035): the owner is the only builder in v1 |
| 3 | `$(TeamIdentifierPrefix)` does not expand in one target | `plutil -p` shows a bare `dev.todz`; the container is `nil` | Set `DEVELOPMENT_TEAM` on that target |

**Steps with no backout:** none

`AppConfiguration.swift`, `FileWidgetStore+Shared.swift` and the Darwin notification `dev.todz.widgets.requests` are untouched: they keep calling `SharedFolder.of(bundle:)`, whose signature stays, and the notification does not depend on the path.

## Z. Prove and ship

- [x] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** not applicable, nothing the owner sees changes.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
