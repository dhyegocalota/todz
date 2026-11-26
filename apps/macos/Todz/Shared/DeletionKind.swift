import TodzKit

enum DeletionKind: Identifiable, Hashable {
    case workspace(Workspace)
    case project(Project)

    var id: Self {
        self
    }

    var title: String {
        switch self {
        case .workspace: SheetCopy.deleteWorkspaceTitle
        case .project: SheetCopy.deleteProjectTitle
        }
    }

    var message: String {
        switch self {
        case .workspace: SheetCopy.deleteWorkspaceMessage
        case .project: SheetCopy.deleteProjectMessage
        }
    }

    var name: String {
        switch self {
        case let .workspace(workspace): workspace.name
        case let .project(project): project.name
        }
    }

    var target: WriteTarget {
        switch self {
        case let .workspace(workspace): .workspaceRemoval(workspaceIdentifier: workspace.identifier)
        case let .project(project): .projectRemoval(projectIdentifier: project.identifier)
        }
    }

    @MainActor func isListed(in model: AppModel) -> Bool {
        switch self {
        case let .workspace(workspace): model.workspaces.contains { $0.identifier == workspace.identifier }
        case let .project(project): model.workspaces.flatMap(\.projects).contains { $0.identifier == project.identifier }
        }
    }

    @MainActor func delete(in model: AppModel) async {
        switch self {
        case let .workspace(workspace): await model.deleteWorkspace(identifier: workspace.identifier)
        case let .project(project): await model.deleteProject(projectIdentifier: project.identifier)
        }
    }
}
