# Plan: Mac app shell

**Spec:** spec.md
**Tier:** 🔴
**Seam:** a new `apps/macos` (the `TodzKit` package and the `Todz` app target), the `macos` gate in `scripts/verify.sh`, `xcodegen` in the doctor, one row each in `apps/README.md`, `AGENTS.md`'s layout and `delivery-docs.test.ts`
**Assumptions (decided, owner can override):**
- ADRs 0024 to 0026 and the decisions of `design.md` § 7 are the loop's calls, listed in the loop's questions. No third-party Swift dependency: Foundation, SwiftUI, Observation and Swift Testing only.
- Swift 6 language mode, strict concurrency. Tests are Swift Testing (`import Testing`, `@Test`, `#expect`, `#require`), run with `swift test` from `apps/macos/TodzKit`.
- The repository's conventions hold in Swift: no comments but `// NB ADR NNNN:` pointers, no `??` default to mask absence, flat `if`s and early returns (`guard … else { return | throw }` is Swift's early return and is allowed; no `else` branch otherwise), enums over string literals, constants at the top of the file, named arguments (Swift labels), array methods over loops, no acronyms in identifiers (`identifier`, not `id`, for new Swift names; JSON keys stay as the API sends them and map through `CodingKeys` only where the Swift name differs).
- JSON fixtures in tests are shaped exactly as `apps/api/src/owner-json.ts` writes them; secrets and identities in tests are generated at run time (`UUID().uuidString`), never literal tokens.
- Files are written with the Write and Edit tools: `guard-secrets.sh` blocks code heredocs and any shell line with an expansion.
- Red-first: each red commit holds the failing test alone (a stub that `fatalError("<name> is not implemented")` is allowed so the package compiles); its commit body records the failure text the red run printed.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `scripts/verify.sh`, `scripts/verify-gates.tsv`, `scripts/verify.test.sh`, `.agents/hooks/doctor.sh`, `.agents/hooks/hooks.test.sh`, `.gitignore` | `developer-gate`, worktree lane |
| G2 | `apps/macos/TodzKit/**` | `developer-kit`, worktree lane |
| G3 | `apps/macos/project.yml`, `apps/macos/Todz/**`, `apps/macos/README.md`, `apps/README.md`, `AGENTS.md` (layout line), `tools/repository-shape/src/delivery-docs.test.ts` (`FEATURE_PACKAGES`), `docs/features/mac-app-shell/tester-briefing.md` | `developer-app`, after the lead merges G1 and G2 |

**Briefing.** G1 and G2 never write `tester-briefing.md`: each red commit's body carries its failure text, and G3 copies them from `git log` into the briefing with its own.

## Sequencing

G1 and G2 run in parallel, one worktree each, branched from `feat/mac-app-shell`; neither touches the other's paths. The lead merges G1, then G2 (merge, never rebase), runs `swift test` and `bash scripts/verify.test.sh`, and hands G3 to `developer-app` on the merged branch, because G3 builds on `AppModel` and the gate.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G1

- [x] **Step 1:** red then green: `scripts/verify-gates.tsv` maps `apps/macos/*` to `product` and `macos`, directly before the `apps/*` row (after the README rows); `macos` joins `ALL_GATES`; `gate_macos` runs `swift test --package-path apps/macos/TodzKit`, then `xcodegen generate --spec apps/macos/project.yml`, then `xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build`; a missing `swift` or `xcodegen`, or an `xcodebuild -version` that fails, fails with `<tool> is not installed. fix: <doctor fix line>`. `verify.test.sh` pins: `--plan` for `apps/macos/Todz/TodzApp.swift` prints class `product`, gates `doctor format secrets audit shape macos`, packages `-`; `--plan` for `apps/macos/README.md` prints class `docs`; a run with stubbed `swift`, `xcodegen` and `xcodebuild` calls them in that order; a run without `xcodegen` on the path fails with the fix line. Existing pins that list `ALL_GATES` gain `macos`. — evidence: red `e312d09`, green `c8a935c`
- [x] **Step 2:** red then green: `doctor.sh` reports `xcodegen` as optional (lost: generating the macOS app's Xcode project; fix through `install_with xcodegen "https://github.com/yonaskolb/XcodeGen#installing"`, as gitleaks and ffmpeg do) and `check_xcodebuild` requires `xcodebuild -version` to exit 0; `hooks.test.sh` pins the xcodegen line on Darwin with and without the tool, and an `xcodebuild` stub that fails `-version` reports missing. — evidence: red `e312d09`, green `8d969f5`
- [x] **Step 3:** `.gitignore` gains `apps/macos/Todz.xcodeproj/`, `apps/macos/build/`, `apps/macos/TodzKit/.build/` and `apps/macos/TodzKit/.swiftpm/`; `git check-ignore` proves each. — evidence: `git check-ignore --no-index -v` names `.gitignore:18` to `.gitignore:21` for the four paths, commit `64d3ded`

### G2

- [x] **Step 4:** pin: `Package.swift` (tools 6.0, macOS 14, library `TodzKit`, test target `TodzKitTests`), `OwnerEnums.swift` with raw values copied from `libs/types/src/task.ts`; a test decodes every raw value and fails on an unknown one. pin `8fb0f20` (`OwnerEnumsTests`, 7 tests).
- [x] **Step 5:** red then green: `OwnerModels.swift` and `OwnerEnvelopes.swift` decode the owner, workspace (with projects, Inbox first), project, task, actor, history entry, change page and sign-in answer, and every answer wrapper of the spec (`{ owner }`, `{ workspaces }`, `{ workspace }`, `{ project }`, `{ task }`, `{ tasks: [{ task, replayed }] }`, `{ tasks: [{ task, already_done }] }`, `{ tasks: [{ task, already_open }] }`, `{ history }`), from fixtures shaped as `owner-json.ts`; epoch milliseconds become `Date`; `due_date` becomes `CalendarDate?`; `notes` and `completed_at` stay optional; a task with `state: "archived"` fails decoding; `TaskLimits.swift` holds 200, 20 000 and 80 (`OwnerModelsTests`). Red `f2ca35c`, green `f37cbaf`.
- [x] **Step 6:** red then green: `CalendarDate` parses `2026-11-24`, refuses `2026-02-30`, `2026-1-5` and `""`, formats back, orders, and `today(in:at:)` answers the Mac zone's date at both sides of midnight (`CalendarDateTests`). Red `cc8f5c2`, green `a7aa149`.
- [x] **Step 7:** red then green: `OwnerAPI` over a `URLProtocol` stub: each route the shell uses (including `PATCH /owner { time_zone }`) sends its method, path, `Authorization: Bearer <session>` from its `session:` argument (none for sign-in), JSON body in snake_case, and unwraps its success envelope to the inner value; each row of the owner API's error table maps to its `OwnerAPIError` case (401 empty → `unauthorized`, 401 `identity_rejected`, 404 empty and `not_found` → `notFound`, `task_not_found` with `number`, 409 `inbox_is_fixed`, 409 `cursor_ahead`, 422 `rule_violated` with `issue` and `index`, 422 `time_zone_invalid`, 400 → `invalidRequest`, 503 → `signInUnavailable`, any other status → `unexpected(status:)`); a `URLError` → `unreachable` (`OwnerAPITests`). Red `8e342dc`, green `79ad360`.
- [x] **Step 8:** red then green: `FileSessionVault` writes the secret atomically with mode `0600`, reads it back, answers `nil` when the file is absent, throws when it exists but is unreadable, and `erase` removes it and is idempotent (`FileSessionVaultTests`, in a temporary folder). Red `cc4a206`, green `4c52247`.
- [x] **Step 9:** red then green: `TaskBoard` merges pages by task number (a copy replaces the held one only when its `updatedAt` is not older; an older copy never replaces a newer one), `replace` and `reset`; `ProjectFeed.pull` reads pages until `has_more` is false and restarts once from 0 on `cursorAhead`, a second `cursorAhead` throws (`TaskBoardTests`, `ProjectFeedTests` over a fake `OwnerService`). Red `a6c150d`, green `2408594`.
- [x] **Step 10:** red then green: `TaskViews` for empty, one and many tasks: Inbox and project (open, by order key, byte order), Today (earliest due first, so overdue before today; ties by the project's sidebar position, then order key, then task number; then done today by newest completion), Upcoming (due after today, same order), Done (newest completion first, then project position, then number); a task due yesterday is in Today, due tomorrow in Upcoming, done yesterday not in "Done today"; two projects' tasks with the same due date and order key `a0` come out in sidebar order (`TaskViewsTests`). Red `76b680a`, green `8f53a43`.
- [x] **Step 11:** red then green: `TaskPlacementRequest` maps a move in the visible open list T-1, T-2, T-3, T-4: T-2 up one → `first`; T-4 up one → `after 2`; T-1 down one → `after 2`; T-1 past the end → `after 4`; T-4 to the top by drag → `first` (a move to the top is `first`, any other is `after <the task above>`; `before` is never sent); a move onto itself → `nil` (`TaskPlacementRequestTests`). Red `ddfb86d`, green `18b6302`.
- [x] **Step 12:** red then green: `AppModel` over a fake `OwnerService`, an in-memory `SessionVault`, a fixed clock and zone: Red `db1e2dc`, green `b785c39`.
  - launch with no secret → `signedOut(notice: nil)`; with an unreadable vault → `signedOut(notice: .sessionUnreadable)`; with a secret → `PATCH /owner` with the zone, then `GET /owner/workspaces`;
  - sign in stores the secret and answers `naming` with no workspace, `ready` with one (the oldest active, Inbox selected); a vault write failure → `ready` with banner `.sessionNotSaved`; `timeZoneInvalid` → `signedOut` with the sign-in error `.timeZoneInvalid`;
  - create the first workspace → `ready` with its Inbox selected; switching workspace resets the board and pulls its projects from 0;
  - add (one idempotency key per add, reused by its Try Again), complete, reopen, update title, notes and due date, move, create and rename project: each marks the task or field in flight while it waits, replaces the task or project from the answer, and on failure leaves the board unchanged;
  - a `ruleViolated` answer is exposed for the field that sent it; `notFound` reloads the workspace and raises the matching gone banner; `unreachable` keeps the board and raises the network banner; a pull where one of three projects fails shows the other two and the `someProjectsFailed` banner, whose Try Again pulls only that project;
  - any `unauthorized`, including in the middle of a pull of five projects: `erase` is called exactly once, no request starts after the 401 is handled, phase `signedOut(notice: .sessionEnded)`;
  - sign out calls `SignOut`, erases the vault and answers `signedOut(notice: nil)` (`AppModelTests`).
- [x] **Step 13:** pin: `LiveOwnerAPITests`, enabled only when `TODZ_LIVE_API_URL` is set, signs in with a fresh identity, creates a workspace, adds, updates, completes and reopens a task, pulls changes from 0 and reads history against `wrangler dev`. pin `5355b4c`; run against `wrangler dev` on port 8799 on 2026-11-24, 2 tests passed.

### G3

- [ ] **Step 14:** `project.yml` (bundle `dev.todz.Todz`, macOS 14.0, Swift 6, ad-hoc, sandbox with `network.client`, `NSAllowsLocalNetworking`, `TodzAPIBaseURL` = `http://localhost:8787`, the `TodzKit` package, scheme `Todz`); `TodzApp.swift`; `RootView`; `SignInScreen`; `FirstWorkspaceScreen` with the copy enums of `design.md` § 4; `xcodegen generate` and `xcodebuild build` succeed with zero warnings from `Todz` sources.
- [ ] **Step 15:** `MainWindow` with `SidebarView` (switcher, the four views, projects, new project), `TaskListView` (add field, rows with checkbox, title, due label, project tag in cross-project views, short id, sections of Today, Upcoming and Done, drag to reorder in Inbox and project), `InspectorView` (project, due date popover, how it was added, notes with inline Markdown, history), the sheets, the waiting states, the keys of `design.md` § 5 (⌘N, Return, Escape, Space, ⌘↩, ⌥⌘↑ and ⌥⌘↓ Move Up and Move Down, ⌘R, ⇧⌘N, ⌥⌘I, ⌃⌘S), the File, View and Task menus and Sign Out in the app menu, the row's accessibility label, value and actions, every notice of `design.md`; builds with `grep -c 'warning:'` = 0 on the build log for files under `apps/macos/Todz/` and `apps/macos/TodzKit/Sources/`.
- [ ] **Step 16:** `apps/macos/README.md` (purpose only, links `TodzKit/` and `Todz/`), the `apps/README.md` row, the `AGENTS.md` layout line for `apps/macos`, `apps/macos` in `FEATURE_PACKAGES` if that list requires it; `pnpm --filter @todz/repository-shape exec vitest run` green.
- [ ] **Step 17:** `tester-briefing.md`: what changed, how to start `wrangler dev` on a fresh `--persist-to` and the app (the exact commands of the test plan's walk section), the `curl` sequence for an agent's write, the red texts from `git log`, hypotheses to attack, known gaps.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | the new row sits below `apps/*` and never matches | `--plan` for a Swift file prints gates `typecheck unit` and `jq` fails on a missing `package.json` | rows are first-match: put it above |
| 1 | `xcodebuild` writes into `~/Library/Developer` and fills the disk across worktrees | derived data outside the repository | always `-derivedDataPath apps/macos/build` |
| 5 | the API's JSON drifts from the fixtures | the live suite (step 13) fails decoding while the stubbed suite is green | fixtures copied from a real `wrangler dev` answer |
| 7 | `URLProtocol` stubs leak between parallel tests | a test receives another test's answer | one `URLSession` per test with its own stub registry, `.serialized` suite |
| 8 | the vault writes into the real container from tests | a `session` file appears under `~/Library/Containers/dev.todz.Todz` | the vault takes its folder as a parameter; tests pass a temporary folder |
| 12 | `@MainActor` model tests hang or race | a test never finishes | tests are `@MainActor`, the fake service answers synchronously |
| 14 | the build signs with a team or asks for one | `xcodebuild` fails with "requires a development team" | `CODE_SIGN_IDENTITY = "-"`, `CODE_SIGN_STYLE = Manual`, no `DEVELOPMENT_TEAM` |
| 14 | the app reads the login keychain and hangs on a prompt | a `SecurityAgent` dialog during the walk | ADR 0025: the file vault only; no `Security` import in the app |
| 15 | `.inspector` or `onMove` behaves differently on macOS 14 | the walk shows no inspector or rows that cannot move | `TaskPlacementRequest` is unit-tested; the view is the thin part |

Steps with no backout: none; nothing is deployed and nothing outside `apps/macos` depends on it.
