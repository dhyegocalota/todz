import SwiftUI
import TodzKit

struct SettingsConnectedApps: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if model.isReady {
            Section {
                Text(SettingsCopy.connectedAppsDetail)
                    .settingsDetail()
                ConnectedAppRows()
            } header: {
                Text(SettingsCopy.connectedApps)
            }
            .task { await model.loadConnectedApps() }
            .onDisappear { model.forgetConnectedApps() }
        }
    }
}
