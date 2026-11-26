# Settings layout test plan

## Unit (TodzKit, `swift test --package-path apps/macos/TodzKit`)

- [ ] Not Now is the default answer and the first button, so Return declines.
- [ ] Escape declines.
- [ ] The buttons are Not Now then Share; a button index answers with its button.
- [ ] A workspace with a named project and an Inbox counts two projects.
- [ ] A workspace with only an Inbox counts one project.

## Visual (Debug build, no input events)

- [ ] The Settings window shows six headers in order: General, Proactive, Privacy & updates, Workspaces, Workspace shortcuts, Server.
- [ ] Each description wraps in full; none is cut with an ellipsis.
- [ ] Each switch sits on the first line of its title, including rows with three-line details.
- [ ] The Server address field has a visible "Server address" label; no unlabelled grey field remains.
- [ ] The window opens at 520 by 640 and can be resized down to 460 by 420.
- [x] Dark and light appearance captured (`apps/docs/images/settings-layout/`, shots 01 to 04). The light captures were taken with the appearance forced in-process, not the system setting.

## User walk (tester, Debug app)

- [ ] First launch with no answer yet: the usage alert shows Not Now as the default; Return keeps sharing off, and the Settings switch stays off.
- [ ] The same alert, Escape: sharing stays off.
- [ ] The same alert, Share: sharing turns on, and the Settings switch reads on.
- [ ] A workspace with only an Inbox reads "1 project" in the workspace list.
