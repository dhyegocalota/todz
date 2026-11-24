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

- [ ] **Step 1:** red then green: `scripts/verify-gates.tsv` maps `apps/macos/*` to `product` and `macos`, above `apps/*`; `macos` joins `ALL_GATES`; `gate_macos` runs `swift test --package-path apps/macos/TodzKit`, then `xcodegen generate --spec apps/macos/project.yml`, then `xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build`; a missing `swift`, `xcodegen` or `xcodebuild` fails with `<tool> is not installed. fix: <doctor fix line>`. `verify.test.sh` pins: `--plan` for `apps/macos/Todz/TodzApp.swift` prints class `product`, gates `doctor format secrets audit shape macos`, packages `-`; a run with stubbed `swift`, `xcodegen` and `xcodebuild` calls them in that order; a run without `xcodegen` on the path fails with the fix line. Existing pins that list `ALL_GATES` gain `macos`.
- [ ] **Step 2:** red then green: `doctor.sh` reports `xcodegen` as optional (lost: generating the macOS app's Xcode project; fix: `brew install xcodegen` on Darwin, the Swift install link elsewhere) and `hooks.test.sh` pins the line on Darwin with and without the tool.
- [ ] **Step 3:** `.gitignore` gains `apps/macos/Todz.xcodeproj/` and `apps/macos/build/` (and `apps/macos/TodzKit/.build/`); `git check-ignore` proves each.

### G2

- [ ] **Step 4:** pin: `Package.swift` (tools 6.0, macOS 14, library `TodzKit`, test target `TodzKitTests`), `OwnerEnums.swift` with raw values copied from `libs/types/src/task.ts`; a test decodes every raw value and fails on an unknown one.
- [ ] **Step 5:** red then green: `OwnerModels.swift` decodes the owner, workspace (with projects, Inbox first), project, task, actor, history entry, change page and sign-in answer, from fixtures shaped as `owner-json.ts`; epoch milliseconds become `Date`; `due_date` becomes `CalendarDate?`; a task with `state: "archived"` fails decoding (`OwnerModelsTests`).
- [ ] **Step 6:** red then green: `CalendarDate` parses `2026-11-24`, refuses `2026-02-30`, `2026-1-5` and `""`, formats back, orders, and `today(in:at:)` answers the Mac zone's date at both sides of midnight (`CalendarDateTests`).
- [ ] **Step 7:** red then green: `OwnerAPI` over a `URLProtocol` stub: each route the shell uses sends its method, path, `Authorization: Bearer <session>` (none for sign-in), JSON body in snake_case, and decodes its success answer; each row of the owner API's error table maps to its `OwnerAPIError` case (401 empty → `unauthorized`, 401 `identity_rejected`, 404 empty and `not_found` → `notFound`, `task_not_found` with `number`, 409 `inbox_is_fixed`, 409 `cursor_ahead`, 422 `rule_violated` with `issue` and `index`, 422 `time_zone_invalid`, 400 → `invalidRequest`, 503 → `signInUnavailable`, any other status → `unexpected(status:)`); a `URLError` → `unreachable` (`OwnerAPITests`).
- [ ] **Step 8:** red then green: `FileSessionVault` writes the secret atomically with mode `0600`, reads it back, answers `nil` when the file is absent, throws when it exists but is unreadable, and `erase` removes it and is idempotent (`FileSessionVaultTests`, in a temporary folder).
- [ ] **Step 9:** red then green: `TaskBoard` merges pages by task number (a later copy replaces an earlier one), `replace` and `reset`; `ProjectFeed.pull` reads pages until `has_more` is false and restarts once from 0 on `cursorAhead`, a second `cursorAhead` throws (`TaskBoardTests`, `ProjectFeedTests` over a fake `OwnerService`).
- [ ] **Step 10:** red then green: `TaskViews` for empty, one and many tasks: Inbox and project (open, by order key, byte order), Today (overdue first, then today, earliest due then order key; then done today by newest completion), Upcoming (due after today, earliest due then order key), Done (newest completion first); a task due yesterday is in Today, due tomorrow in Upcoming, done yesterday not in "Done today" (`TaskViewsTests`).
- [ ] **Step 11:** red then green: `TaskPlacementRequest` maps a move in the visible open list to `first`, `after <number>` (anchor is the task above the destination), and answers `nil` for a move onto itself (`TaskPlacementRequestTests`).
- [ ] **Step 12:** red then green: `AppModel` over a fake `OwnerService`, an in-memory `SessionVault`, a fixed clock and zone: launch with no secret → `signedOut`; sign in stores the secret and answers `naming` with no workspace, `ready` with one; create the first workspace → `ready` with its Inbox selected; switching workspace pulls its projects; add (with an idempotency key), complete, reopen, update title, notes and due date, move, create and rename project, each replacing the task or project from the answer and changing nothing on failure; a `ruleViolated` answer is exposed for the field; any `unauthorized` erases the vault and answers `signedOut` with the session-ended notice; `unreachable` keeps the board and sets the offline notice; `notFound` reloads; sign out erases the vault (`AppModelTests`).
- [ ] **Step 13:** pin: `LiveOwnerAPITests`, enabled only when `TODZ_LIVE_API_URL` is set, signs in with a fresh identity, creates a workspace, adds, updates, completes and reopens a task, pulls changes from 0 and reads history against `wrangler dev`.

### G3

- [ ] **Step 14:** `project.yml` (bundle `dev.todz.Todz`, macOS 14.0, Swift 6, ad-hoc, sandbox with `network.client`, `NSAllowsLocalNetworking`, `TodzAPIBaseURL` = `http://localhost:8787`, the `TodzKit` package, scheme `Todz`); `TodzApp.swift`; `RootView`; `SignInScreen`; `FirstWorkspaceScreen` with the copy enums of `design.md` § 4; `xcodegen generate` and `xcodebuild build` succeed with zero warnings from `Todz` sources.
- [ ] **Step 15:** `MainWindow` with `SidebarView` (switcher, the four views, projects, new project), `TaskListView` (add field, rows with checkbox, title, due label, project tag in cross-project views, short id, sections of Today, Upcoming and Done, drag to reorder in Inbox and project), `InspectorView` (project, due date popover, how it was added, notes with inline Markdown, history), the sheets, ⌘N, ⌘R, ⌥⌘I, Space and ⌘↩, every notice of `design.md`; builds clean.
- [ ] **Step 16:** `apps/macos/README.md` (purpose only, links `TodzKit/` and `Todz/`), the `apps/README.md` row, the `AGENTS.md` layout line for `apps/macos`, `apps/macos` in `FEATURE_PACKAGES` if that list requires it; `pnpm --filter @todz/repository-shape exec vitest run` green.
- [ ] **Step 17:** `tester-briefing.md`: what changed, how to start `wrangler dev` on a fresh `--persist-to` and the app, the red texts from `git log`, hypotheses to attack, known gaps.

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
