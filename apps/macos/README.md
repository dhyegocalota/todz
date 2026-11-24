# Todz for macOS

The native app where the owner sees and changes the tasks they share with their agents, against the owner API, from a copy kept on this Mac and kept in sync live.

[TodzKit](TodzKit/) holds everything that is not a view: the owner's models, the client of the owner API, the private keeping of the session and of the cached tasks on this Mac, the queue of changes waiting for the server, the live sync with each project, the rules that build the Inbox, Today, Upcoming, Done and project views from each project's changes, and what the widgets show and ask for. The main window, the menu bar extra and the widgets share it.

[Todz](Todz/) is the app itself: signing in, naming the first workspace, the main window with its sidebar, task list and inspector, the key screen where the owner connects Claude Code, Codex or Cursor to one project with a key shown once inside each client's command and revokes the project's keys, and the menu bar extra, where Today of the active workspace can be read, added to and checked off without the main window, and the first nine workspaces are a keystroke away. The menu bar icon shows how many of Today's tasks are still open, and a Settings window turns that count off. The app keeps running in the menu bar when the main window closes. It opens on what this Mac already holds, shows the owner's change at once and sends it when the server is reachable, says when it is offline, and shows an agent's change while the window is open, with the client that made it.

[TodzWidgets](TodzWidgets/) holds the desktop widgets: a Today progress ring, the next task due, and a medium and a large list of Today for the active workspace, whose checkboxes complete or reopen a task without opening the app. They read only what the app last wrote for them, in the App Group container the app and the widgets share, and a tap on a widget opens the main window on Today or on that task.

The app and the widgets are signed with the owner's Personal Team, so only a Mac that holds that Apple Development identity can build them. The folder in the account's Application Support that earlier builds shared is left behind, because the sandboxed app can no longer reach it; it can be deleted by hand.

[Copy](Copy/) holds every string the app and the widgets show.
