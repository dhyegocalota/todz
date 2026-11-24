# Todz for macOS

The native app where the owner sees and changes the tasks they share with their agents, against the owner API.

[TodzKit](TodzKit/) holds everything that is not a view: the owner's models, the client of the owner API, the private keeping of the session on this Mac, and the rules that build the Inbox, Today, Upcoming, Done and project views from each project's changes. The menu bar extra and the widgets are meant to share it.

[Todz](Todz/) is the app itself: signing in, naming the first workspace, and the main window with its sidebar, task list and inspector. It never shows a change the server has not answered, and an agent's work shows which client did it.
