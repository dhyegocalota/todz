import SwiftUI
import TodzKit

private let serverURL = AgentCommand.serverURL(apiBase: AppConfiguration.baseURL)

struct KeyScreen: View {
    let workspace: Workspace
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            if let project = model.keyProject {
                VStack(alignment: .leading) {
                    KeyScreenHeader(workspace: workspace, project: project)
                    Text(KeyScreenCopy.intro)
                        .foregroundStyle(.secondary)
                    KeyCreation()
                    ClientCommands(serverURL: serverURL, secret: model.issuedKey?.secret)
                    Divider()
                    InspectorSectionTitle(title: KeyScreenCopy.serverURL)
                    CommandBlock(
                        name: KeyScreenCopy.serverURL,
                        caption: nil,
                        text: serverURL.absoluteString,
                        holdsSecret: false,
                        disabledReason: nil
                    )
                    Divider()
                    InspectorSectionTitle(title: KeyScreenCopy.tools)
                    ToolList()
                    Divider()
                    InspectorSectionTitle(title: KeyScreenCopy.keys)
                    KeyRows(projectName: project.name)
                    Text(KeyScreenCopy.keysFooter)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color(nsColor: .windowBackgroundColor))
        .onDisappear { model.hideKey() }
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                SyncStatusItem(announcesChanges: true)
                RefreshButton()
            }
        }
    }
}
