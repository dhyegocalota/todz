enum MainWindowCopy {
    static func workspaceTag(workspaceName: String, projectName: String) -> String {
        "\(workspaceName) · \(projectName)"
    }

    static func newProjectHelp(workspaceName: String) -> String {
        Localized.text("Adds a project to \(workspaceName)")
    }

    static let windowTitle = "todz"
    static var inbox: String { Localized.text("Inbox") }
    static var today: String { Localized.text("Today") }
    static var upcoming: String { Localized.text("Upcoming") }
    static var done: String { Localized.text("Done") }
    static var projects: String { Localized.text("Projects") }
    static var doneToday: String { Localized.text("Done Today") }
    static var tomorrow: String { Localized.text("Tomorrow") }
    static var todayGroup: String { Localized.text("Today") }
    static var yesterday: String { Localized.text("Yesterday") }
    static var newWorkspace: String { Localized.text("New Workspace…") }
    static var allWorkspaces: String { Localized.text("All Workspaces") }
    static var newProject: String { Localized.text("New Project…") }
    static var newProjectButton: String { Localized.text("New Project") }
    static var renameProject: String { Localized.text("Rename…") }
    static var deleteProject: String { Localized.text("Delete Project…") }
    static var renameWorkspace: String { Localized.text("Rename Workspace…") }
    static var deleteWorkspace: String { Localized.text("Delete Workspace…") }
    static var signOut: String { Localized.text("Sign Out") }
    static var newTask: String { Localized.text("New Task") }
    static var refresh: String { Localized.text("Refresh") }
    static var moveUp: String { Localized.text("Move Up") }
    static var moveDown: String { Localized.text("Move Down") }
    static var markDone: String { Localized.text("Mark as Done") }
    static var markNotDone: String { Localized.text("Mark as Not Done") }
    static var deleteTask: String { Localized.text("Delete Task…") }
    static var showInspector: String { Localized.text("Show Inspector") }
    static var hideInspector: String { Localized.text("Hide Inspector") }
    static var taskMenu: String { Localized.text("Task") }
    static var addPlaceholder: String { Localized.text("Add a task") }
    static var loading: String { Localized.text("Loading…") }
    static var tryAgain: String { Localized.text("Try Again") }
    static var dismiss: String { Localized.text("Dismiss") }
    static var inboxEmptyTitle: String { Localized.text("Inbox is empty") }
    static var inboxEmptyBody: String { Localized.text("Add a task with ⌘N.") }
    static var todayEmptyTitle: String { Localized.text("Nothing due today") }
    static var todayEmptyBody: String { Localized.text("Tasks due today or earlier show up here.") }
    static var upcomingEmptyTitle: String { Localized.text("Nothing upcoming") }
    static var upcomingEmptyBody: String { Localized.text("Tasks with a future due date show up here.") }
    static var doneEmptyTitle: String { Localized.text("Nothing done yet") }
    static var doneEmptyBody: String { Localized.text("Completed tasks show up here.") }
    static var projectEmptyTitle: String { Localized.text("No open tasks") }
    static var projectEmptyBody: String { Localized.text("Add a task with ⌘N.") }
}
