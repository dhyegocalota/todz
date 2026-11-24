import SwiftUI
import TodzKit

struct SidebarView: View {
    let workspace: Workspace
    @Environment(AppModel.self) private var model

    var body: some View {
        List(selection: selection) {
            Section {
                ForEach(SidebarItem.views, id: \.self) { item in
                    if let title = item.title(in: workspace) {
                        Label(title, systemImage: item.symbol)
                            .openCountBadge(model.openCount(of: item))
                            .tag(item)
                    }
                }
            }
            Section {
                ForEach(projects, id: \.identifier) { project in
                    ProjectRow(project: project)
                }
            } header: {
                ProjectsHeader()
            }
        }
        .listStyle(.sidebar)
        .safeAreaInset(edge: .top) {
            WorkspaceSwitcher(workspace: workspace)
        }
    }

    private var projects: [Project] {
        workspace.projects.filter { !$0.isInbox }
    }

    private var selection: Binding<SidebarItem?> {
        Binding {
            model.selectedItem
        } set: { item in
            guard let item else { return }
            model.selectedItem = item
        }
    }
}
