# Workspace lock

**Status:** Shipped 2026-11-26
**Tier:** 🔴 (a privacy guarantee: every path that could show another workspace is a bypass; a Settings change; no server, no schema, no deploy)
**Owner approval:** approved by inheritance from [docs/product/README.md](../../product/README.md) (2026-11-23) and the owner's order of 2026-11-27, "uma feature flag desativada por padrão que deixe bem difícil fazer switch/selecionar diferentes workspaces… porque não quero outras pessoas bisbilhotando outros workspaces de jeito nenhum".
**ADRs:** [0110](../../adr/0110-the-workspace-lock-hides-every-workspace-but-the-current-one-until-touch-id-or-the-mac-password-unlocks-a-session.md) (builds on [0080](../../adr/0080-the-workspace-picker-selects-several-workspaces-or-all-and-every-surface-shows-their-union-tagged-by-workspace.md))
**Not changing:** the server, the owner API, project keys and account keys (agents with a key still reach their project), the sync cache format, the widget extension's code

## Problem

Anyone at an unlocked Mac can open todz and switch to any workspace. The owner wants a switch, off by default, that makes that hard.

## Goals

- A Settings switch, off by default, kept per Mac. Turning it on needs no authentication and locks at once.
- While it is on and the session is locked, exactly one workspace is visible: the current one. Every other workspace is "Locked workspace" with no name, count or project, in every list, menu and picker.
- Touch ID or the Mac password unlocks the session; then workspaces switch normally until a relock.
- Authentication is required to show another workspace (picker, menus, ⌃1…9, ⌃⌘[ ], global hot keys, choosing at launch), to create or delete a workspace, to turn the switch off and to change the idle timeout.
- A relock happens on system sleep, display sleep, screen lock, screensaver start, the idle timeout (1, 5 default, 15 or 60 minutes with no input delivered to todz) and Lock Now; a launch is always locked.
- On a relock the selection collapses to the workspace on screen, the other workspaces' boards, watches and cached tasks are released (a locked launch erases their cached tasks too), and the shared widget snapshot is rewritten from that workspace alone before every timeline reloads.
- Widget requests, `todz://` task links, App Intents and the task writes that name a locked workspace are refused and return nothing of it.

## Non-goals

- Protection against someone who can run commands as this macOS user: the preferences file and the app's own folder are theirs to edit.
- Locking the server, the MCP surface or any other device.
- Notifications: todz posts no system notification today, so there is nothing to redact; a future one must go through the same lock.

## Design

- TodzKit: `WorkspaceLock` (switch, in-memory session, timeout, idle clock, one shared authentication in flight), `WorkspaceLockPreference`, `WorkspaceLockTimeout`, `WorkspaceLockAction`, `RelockTrigger`, `DeviceOwnerAuthenticator` (a port with a fake in tests) and `PresentedWorkspace`. `AppModel.shownWorkspaces` goes through `WorkspaceLock.visible`, so everything derived from it (task views, snapshot, intents, glances, ribbon, count) sees the current workspace only. `selectWorkspaces`, `chooseWorkspaces`, `createWorkspace` and `deleteWorkspace` ask first; renames and deletes of a locked workspace's project or workspace, a link, an intent and `enqueue` refuse. A relock collapses the selection and republishes the widgets.
- App: `MacOwnerAuthenticator` (LocalAuthentication `.deviceOwnerAuthentication`), `WorkspaceLockMonitor` (sleep, screen lock, screensaver, local input monitor and a ten-second idle check), `SettingsWorkspaceLock`, `LockedWorkspaceRow`, the switcher, the Workspace menu, the Settings lists and the picker, per [design.md](design.md).

## Failure handling

- A cancelled prompt changes nothing and says nothing; a failed one says "Couldn't confirm it's you. Nothing changed." in Settings and as an announcement in menus.
- A Mac with no password (`LAError.passcodeNotSet`) cannot authenticate: the switch cannot be turned on, and a lock already on can still be turned off without a prompt. Any other reason the policy cannot be evaluated (biometry lockout, not interactive, unknown) keeps it locked, even for turning off, and shows the failure line.
- A refused link or intent says "Unlock todz to use that workspace."

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Which idle source | System idle time, input delivered to todz | The loop's call: input delivered to todz, the stricter and testable one | 2026-11-26 |
| Does turning off need authentication while the session is unlocked | Always, only while locked | The loop's call: only while locked; an unlocked session was authenticated | 2026-11-26 |

## Test strategy summary

See [test-plan.md](test-plan.md). The model and every bypass path are unit-tested with Swift Testing against a fake authenticator; the Settings and menu views are checked by a Debug build and in-process renders.
