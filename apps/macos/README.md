# Todz for macOS

The native app where the owner sees and changes the tasks they share with their agents, against the owner API, from a copy kept on this Mac and kept in sync live.

[TodzKit](TodzKit/) holds everything that is not a view: the owner's models, the client of the owner API, the private keeping of the session and of the cached tasks on this Mac, the queue of changes waiting for the server, the live sync with each project, and the rules that build the Inbox, Today, Upcoming, Done and project views from each project's changes. The menu bar extra shares it with the main window, and the widgets are meant to.

[Todz](Todz/) is the app itself: signing in, naming the first workspace, the main window with its sidebar, task list and inspector, and the menu bar extra, where Today of the active workspace can be read, added to and checked off without the main window, and the first nine workspaces are a keystroke away. The app keeps running in the menu bar when the main window closes. It opens on what this Mac already holds, shows the owner's change at once and sends it when the server is reachable, says when it is offline, and shows an agent's change while the window is open, with the client that made it.
