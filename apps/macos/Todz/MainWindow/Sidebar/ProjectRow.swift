import SwiftUI
import TodzKit

struct ProjectRow: View {
    let project: Project
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState

    var body: some View {
        Text(label)
            .lineLimit(1)
            .truncationMode(.tail)
            .help(label)
            .openCountBadge(model.openCount(of: item))
            .tag(item)
            .contextMenu {
                Button(MainWindowCopy.renameProject) {
                    windowState.sheet = .renameProject(project)
                }
                Button(MainWindowCopy.deleteProject) {
                    windowState.deletion = .project(project)
                }
            }
    }

    private var label: String {
        guard let workspaceName = model.taggedWorkspaceName[project.identifier] else { return project.name }
        return MainWindowCopy.workspaceTag(workspaceName: workspaceName, projectName: project.name)
    }

    private var item: SidebarItem {
        .project(identifier: project.identifier)
    }
}
