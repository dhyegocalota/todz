# Workspace select test plan

## Unit (TodzKit, `swift test --package-path apps/macos/TodzKit --filter WorkspaceChoice`)

- [x] Two workspaces, no remembered choice, signed in: the phase is `choosing`, no workspace is active, and the listing is the only call. — evidence: a3473990, swift test 1349 Swift Testing tests in 107 suites passed, the 10 WorkspaceChoice tests among them; red at 679f1901 with 9 issues
- [x] One workspace, no remembered choice: the phase is `ready` and that workspace is active (unchanged). — evidence: a3473990, signingInWithOneWorkspaceOpensIt passes (pin); walk: Solo opened directly
- [x] No workspace: the phase is `naming` (unchanged). — evidence: a3473990, signingInWithNoWorkspaceNamesTheFirstOne passes (pin); walk: "Name your first workspace"
- [x] Two workspaces and a remembered choice for one of them: the phase is `ready` on the remembered one. — evidence: a3473990, signingInOpensTheRememberedWorkspaceWithoutThePicker passes (pin)
- [x] A remembered identifier that is not in the listing: the phase is `choosing`, not the first workspace. — evidence: a3473990, aRememberedWorkspaceThatIsNoLongerListedOpensThePicker passes; red at 679f1901 (`phase == .choosing`, `activeWorkspace == nil` failed)
- [x] `chooseWorkspace(identifier: side)` from `choosing`: the phase is `ready`, `side` is active, and its projects are pulled from cursor zero. — evidence: a3473990, choosingAWorkspaceOpensItAndPullsItsProjectsFromZero passes; red at 679f1901 (`isSameCallSet(harness.service.calls, pulls)` failed)
- [x] `chooseWorkspace(identifier: "unknown")` from `choosing`: the phase stays `choosing` and no call is made. — evidence: a3473990, choosingAnUnlistedWorkspaceChangesNothing passes; red at 679f1901
- [x] `chooseWorkspace` outside `choosing` (phase `ready`): nothing changes. — evidence: a3473990, choosingOutsideThePickerChangesNothing passes (pin)
- [ ] The picker offers exactly the listed workspaces: a workspace from another owner never appears in the listing the model holds. — BLOCKED: no dedicated unit test holds a second owner; the walk (walk-two signed in after walk-multi on one Mac) showed only Alpha Co and Beta Co, none of the first owner's workspaces
- [x] While `choosing`, the widget snapshot is `absent`. — evidence: a3473990, whileChoosingTheWidgetsAreAbsent passes; red at 679f1901 (`widgetSnapshot == .absent` failed)

## User-visible walk (tester, by hand, after the Debug app runs against a local `wrangler dev`)

- [x] Sign in on a Mac with no remembered workspace and an account with two workspaces: the picker shows both names and "N projects" counts, with no "Name your first workspace" title. — evidence: walk at a3473990, walk-multi saw Acme 3 projects, Side Hustle 2 projects, Home 1 projects under "Choose a workspace"; `.pr-media/workspace-select/picker-dark.png`; defect 1 below
- [x] Choosing a row opens that workspace on its Inbox. — evidence: walk, Side Hustle opened on Inbox with Blog and Shop in the sidebar
- [x] "New Workspace…" opens the name sheet; creating one enters it. — evidence: walk, walk-two: the sheet opened from the picker, "Gamma Co" was created and entered on its Inbox, and Settings then listed Alpha Co, Beta Co, Gamma Co with the check on Gamma Co
- [x] Settings lists every workspace, marks the active one, and a tap switches to it. — evidence: walk, Settings showed Acme, Side Hustle, Home with one check; a tap on Home switched the window, the Workspace menu and widget-snapshot.json (Home, 0 open); the menu switch to Acme gave Today 1 and a snapshot of Acme with 1 open; `.pr-media/workspace-select/settings-workspaces-dark.png`, `workspace-menu-dark.png`
- [ ] The popover's ⌘1 and ⌘2 still switch. — BLOCKED: the popover opens in front of the owner's work in a production walk, so it was not driven
- [x] Relaunch with the same workspace remembered: it opens directly, with no picker. — evidence: walk, quit after choosing Side Hustle, relaunched, the window opened on Side Hustle Inbox with Today 2 and no picker
- [ ] Light and dark appearance: the picker and the Settings rows are legible. — BLOCKED: dark only; the system is dark, the picker, Settings rows and menu are legible (the three dark screenshots), light needs a system setting and a per-app AppleInterfaceStyle override did not switch the Debug app

## Edge cases found during execution

- [x] One workspace (walk-single): opened directly on Inbox, no picker — evidence: walk at a3473990.
- [x] A brand-new account (walk-empty): "Name your first workspace" with a disabled Create Workspace button, no picker — evidence: walk at a3473990.
- [x] "New Workspace…" stays in the picker as a link beside Sign Out — evidence: walk at a3473990.
- [x] Two owners on one Mac: walk-two reached the picker although walk-multi had a remembered workspace on this Mac — evidence: walk at a3473990.
- [x] The menu bar count and the widget data follow the switch: Side Hustle shows 2, Home shows no count, and widget-snapshot.json names the active workspace each time — evidence: `.pr-media/workspace-select/menu-bar-count.png`, `menu-bar-count-home.png`; the count's owner is the Debug app only because it vanishes on Home.
- [ ] Defect 1 (minor): the picker and Settings read "1 projects"; expected "1 project". Zero reads "0 projects".
- [ ] Not exercised: a row tapped twice, signing walk-multi back in with Home remembered, a narrow window.
- Observed, outside this feature: Settings shows "Server older · Server needs an update" against `wrangler dev`, and the Server Switch to 127.0.0.1 is refused because the server answers as localhost.

## Tester summary at a3473990

Unit 9 of 10 ticked, 1 BLOCKED. Walk 5 of 7 ticked, 2 BLOCKED. The XCTest "architecture" load error did not show: the log has no such line and 0 XCTest tests ran.
