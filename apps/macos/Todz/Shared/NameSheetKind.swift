import TodzKit

private let newName = ""

enum NameSheetKind: Identifiable, Hashable {
    case newWorkspace
    case newProject
    case renameWorkspace(Workspace)
    case renameProject(Project)

    var id: Self {
        self
    }

    var title: String {
        switch self {
        case .newWorkspace: SheetCopy.newWorkspaceTitle
        case .newProject: SheetCopy.newProjectTitle
        case .renameWorkspace: SheetCopy.renameWorkspaceTitle
        case .renameProject: SheetCopy.renameProjectTitle
        }
    }

    var actionTitle: String {
        switch self {
        case .newWorkspace, .newProject: SheetCopy.create
        case .renameWorkspace, .renameProject: SheetCopy.rename
        }
    }

    var busyTitle: String {
        switch self {
        case .newWorkspace, .newProject: SheetCopy.creating
        case .renameWorkspace, .renameProject: SheetCopy.renaming
        }
    }

    var detail: String? {
        switch self {
        case .newWorkspace: SheetCopy.newWorkspaceDetail
        case .newProject: SheetCopy.newProjectDetail
        case .renameWorkspace, .renameProject: nil
        }
    }

    var initialName: String {
        switch self {
        case .newWorkspace, .newProject: newName
        case let .renameWorkspace(workspace): workspace.name
        case let .renameProject(project): project.name
        }
    }

    var target: WriteTarget {
        switch self {
        case .newWorkspace: .newWorkspace
        case .newProject: .newProject
        case let .renameWorkspace(workspace): .workspaceName(workspaceIdentifier: workspace.identifier)
        case let .renameProject(project): .projectName(projectIdentifier: project.identifier)
        }
    }
}
