# Test plan: workspace lock

Unit tests run with Swift Testing in `apps/macos/TodzKit` (`swift test`) against a fake `DeviceOwnerAuthenticator`. The views and the live LocalAuthentication sheet are checked by a Debug build and in-process renders.

## Defaults

- [ ] The switch reads off on a fresh domain and `registerDefaults` registers off and 5 minutes.
- [ ] An unknown stored timeout reads as 5 minutes; the choices are 1, 5, 15 and 60.
- [ ] A fresh launch with the switch on is locked; with it off nothing is locked.

## What a locked workspace presents

- [ ] Only the current workspace is visible; every other is `locked(identifier:)` and carries no name, count or project.
- [ ] With no current workspace every workspace is locked.
- [ ] A launch that remembered "All" shows and pulls and watches only the current workspace.
- [ ] The snapshot, the task views, the intent queries, the shortcut sentence and the menu bar count hold the current workspace only.

## Which actions authenticate

- [ ] Showing a workspace other than the current one, creating, deleting, turning off and changing the timeout ask while locked; turning on never asks; showing the current one never asks.
- [ ] A refused or cancelled prompt changes nothing and pulls nothing; a failed one is flagged until the next try.
- [ ] Two taps share one prompt; an unlocked session asks no more.
- [ ] A Mac that cannot authenticate refuses everything but turning the switch off.
- [ ] The number and step shortcuts, select all, toggle and the picker all ask.

## Relocks

- [ ] Each of sleep, screen lock, screensaver, idle and Lock Now locks an unlocked session; a locked or switched-off lock ignores them.
- [ ] Idle fires at the chosen timeout exactly and input restarts the clock.
- [ ] A relock collapses the selection to the workspace on screen, releases the others' board and watch, rewrites the snapshot from that workspace alone and reloads the widgets.
- [ ] A relock and a locked launch erase the other workspaces' cached tasks and keep the current one's.
- [ ] Turning the switch on collapses at once without asking.

## Bypass paths

- [ ] A widget request naming a locked workspace, or none, for a locked task is dropped and sends nothing.
- [ ] An intent to complete a locked task is refused and sends nothing; add names only the current workspace.
- [ ] A `todz://` link to a locked task opens Today and raises the unlock line; a link to a current task opens.
- [ ] Rename or delete of a locked workspace or project is refused; any change to a locked project never reaches the outbox.
- [ ] Creating the first workspace needs no authentication.

Not tested here, and not claimed: the system authentication sheet, Touch ID itself, and the idle monitor's AppKit observers; they are covered by the Debug build. Someone running commands as this macOS user can edit the preferences file and the app's folder; the lock does not claim otherwise.
