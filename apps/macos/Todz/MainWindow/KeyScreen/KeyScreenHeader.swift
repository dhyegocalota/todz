import SwiftUI
import TodzKit

struct KeyScreenHeader: View {
    let workspace: Workspace
    let project: Project
    @Environment(AppModel.self) private var model

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline) {
                title
                Spacer()
                picker
            }
            VStack(alignment: .leading) {
                title
                picker
            }
        }
    }

    private var title: some View {
        Text(KeyScreenCopy.title)
            .font(.title)
            .bold()
            .lineLimit(1)
            .accessibilityAddTraits(.isHeader)
    }

    private var picker: some View {
        Picker(KeyScreenCopy.project, selection: selection) {
            ForEach(projects, id: \.identifier) { choice in
                Text(choice.name)
                    .tag(Optional(choice.identifier))
            }
        }
        .pickerStyle(.menu)
        .labelsHidden()
        .help(project.name)
    }

    private var projects: [Project] {
        workspace.projects.filter(\.isInbox) + workspace.projects.filter { !$0.isInbox }
    }

    private var selection: Binding<String?> {
        Binding {
            model.keyProjectIdentifier
        } set: { identifier in
            guard let identifier else { return }
            model.showKeys(projectIdentifier: identifier)
        }
    }
}
