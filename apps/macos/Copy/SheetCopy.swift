enum SheetCopy {
    static func typeNamePrompt(name: String) -> String {
        Localized.text("Type \"\(name)\" to confirm.")
    }

    static var newWorkspaceTitle: String { Localized.text("New Workspace") }
    static var newProjectTitle: String { Localized.text("New Project") }
    static var renameWorkspaceTitle: String { Localized.text("Rename Workspace") }
    static var renameProjectTitle: String { Localized.text("Rename Project") }
    static var deleteWorkspaceTitle: String { Localized.text("Delete Workspace") }
    static var deleteProjectTitle: String { Localized.text("Delete Project") }
    static var deleteWorkspaceMessage: String { Localized.text("This permanently deletes the workspace, its projects, their tasks and the keys agents use to reach them. It cannot be undone.") }
    static var deleteProjectMessage: String { Localized.text("This permanently deletes the project, its tasks and the keys agents use to reach it. It cannot be undone.") }
    static var delete: String { Localized.text("Delete") }
    static var nameLabel: String { Localized.text("Name") }
    static var cancel: String { Localized.text("Cancel") }
    static var create: String { Localized.text("Create") }
    static var rename: String { Localized.text("Rename") }
    static var creating: String { Localized.text("Creating…") }
    static var renaming: String { Localized.text("Renaming…") }
    static var deleting: String { Localized.text("Deleting…") }
    static var renameUnchanged: String { Localized.text("Type a new name to rename.") }
    static var deleteMismatch: String { Localized.text("Type the name exactly as shown.") }
    static var newWorkspaceDetail: String { Localized.text("A workspace keeps its own projects and tasks.") }
    static var newProjectDetail: String { Localized.text("A project groups tasks, and agents connect to it with their own keys.") }
}
