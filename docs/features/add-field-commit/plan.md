# Plan: Add field commit

**Spec:** spec.md
**Tier:** 🟢
**Seam:** `AddTaskField` in `apps/macos/Todz/Shared`, over `AddFieldSubmission` in TodzKit
**Assumptions (decided, owner can override):**
- The accessibility action is named "Add", the word of the action it performs.
- The live suite runs only when `TODZ_LIVE_API_URL` names a Worker, like `LiveOwnerAPITests`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/macos/TodzKit/Tests/TodzKitTests/LiveMultiWorkspaceTests.swift`, `apps/macos/TodzKit/Tests/TodzKitTests/LiveOwnerAPITests.swift` | lane lead, inline |
| G2 | `apps/macos/TodzKit/Sources/TodzKit/AddFieldSubmission.swift`, `apps/macos/TodzKit/Tests/TodzKitTests/AddFieldSubmissionTests.swift`, `apps/macos/Todz/Shared/AddTaskField.swift`, `apps/macos/Copy/AccessibilityCopy.swift` | lane lead, inline |
| G3 | `docs/features/add-field-commit/`, `docs/features/README.md` | lane lead, inline |

## Sequencing

G1, then G2, then G3.

## Steps

### G1

- [x] **Step 1:** Pin: the live suite seeds three workspaces through the owner API and checks the real client's union against a local Worker.

### G2

- [x] **Step 2:** Red: `AddFieldSubmissionTests` with a stub that ignores every title, committed alone.
- [x] **Step 3:** Green: `AddFieldSubmission.of(title:)`; the field submits through it on Return and on the "Add" accessibility action.

### G3

- [x] **Step 4:** Feature folder and index row; the status flips to Shipped in the last commit.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 3 | Return stops adding, or a refused title is cleared | `AddFieldSubmissionTests`, the Debug app check in the test plan | revert the commit |
| 1 | The live suite runs without a Worker and fails CI | the suite is disabled when `TODZ_LIVE_API_URL` is unset; `swift test` on CI | revert the commit |

**Steps with no backout:** none
