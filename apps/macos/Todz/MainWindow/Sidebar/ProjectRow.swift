import SwiftUI
import TodzKit

struct ProjectRow: View {
    let project: Project
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState

    var body: some View {
        Text(project.name)
            .lineLimit(1)
            .truncationMode(.tail)
            .help(project.name)
            .openCountBadge(model.openCount(of: item))
            .tag(item)
            .contextMenu {
                Button(MainWindowCopy.renameProject) {
                    windowState.sheet = .renameProject(project)
                }
            }
    }

    private var item: SidebarItem {
        .project(identifier: project.identifier)
    }
}
