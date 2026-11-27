import SwiftUI
import TodzKit

struct KeyScreen: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let serverURL = AgentCommand.serverURL(apiBase: model.serverURL.url)
        ScrollView {
            VStack(alignment: .leading) {
                Text(KeyScreenCopy.title)
                    .font(.title)
                    .bold()
                    .accessibilityAddTraits(.isHeader)
                VersionLine()
                Text(KeyScreenCopy.intro)
                    .foregroundStyle(.secondary)
                ClientCommands(serverURL: serverURL)
                Link(KeyScreenCopy.readTheGuide, destination: DocumentationAddress.connectAnAgent)
                Divider()
                InspectorSectionTitle(title: KeyScreenCopy.serverURL)
                CommandBlock(name: KeyScreenCopy.serverURL, caption: KeyScreenCopy.serverURLCaption, text: serverURL.absoluteString)
                Divider()
                InspectorSectionTitle(title: KeyScreenCopy.tools)
                ToolList()
                Divider()
                InspectorSectionTitle(title: SettingsCopy.connectedApps)
                Text(SettingsCopy.connectedAppsDetail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                ConnectedAppRows()
            }
            .padding()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color(nsColor: .windowBackgroundColor))
        .task { await model.loadConnectedApps() }
        .onDisappear { model.forgetConnectedApps() }
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                SyncStatusItem(announcesChanges: true)
                RefreshButton()
            }
        }
    }
}
