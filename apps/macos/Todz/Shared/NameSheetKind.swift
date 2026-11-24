import TodzKit

private let newName = ""

enum NameSheetKind: Identifiable, Hashable {
    case newWorkspace
    case newProject
    case renameProject(Project)

    var id: Self {
        self
    }

    var title: String {
        switch self {
        case .newWorkspace: SheetCopy.newWorkspaceTitle
        case .newProject: SheetCopy.newProjectTitle
        case .renameProject: SheetCopy.renameProjectTitle
        }
    }

    var actionTitle: String {
        switch self {
        case .newWorkspace, .newProject: SheetCopy.create
        case .renameProject: SheetCopy.rename
        }
    }

    var initialName: String {
        switch self {
        case .newWorkspace, .newProject: newName
        case let .renameProject(project): project.name
        }
    }

    var target: WriteTarget {
        switch self {
        case .newWorkspace: .newWorkspace
        case .newProject: .newProject
        case let .renameProject(project): .projectName(projectIdentifier: project.identifier)
        }
    }
}
