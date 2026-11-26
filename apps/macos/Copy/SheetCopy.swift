enum SheetCopy {
    static func typeNamePrompt(name: String) -> String {
        "Type \"\(name)\" to confirm."
    }

    static let newWorkspaceTitle = "New Workspace"
    static let newProjectTitle = "New Project"
    static let renameWorkspaceTitle = "Rename Workspace"
    static let renameProjectTitle = "Rename Project"
    static let deleteWorkspaceTitle = "Delete Workspace"
    static let deleteProjectTitle = "Delete Project"
    static let deleteWorkspaceMessage = "This permanently deletes the workspace, its projects, their tasks and the keys agents use to reach them. It cannot be undone."
    static let deleteProjectMessage = "This permanently deletes the project, its tasks and the keys agents use to reach it. It cannot be undone."
    static let delete = "Delete"
    static let nameLabel = "Name"
    static let cancel = "Cancel"
    static let create = "Create"
    static let rename = "Rename"
}
