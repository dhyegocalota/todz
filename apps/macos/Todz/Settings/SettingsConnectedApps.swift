import SwiftUI
import TodzKit

struct SettingsConnectedApps: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if model.isReady {
            Section {
                Text(SettingsCopy.connectedAppsDetail)
                    .settingsDetail()
                list
                if let failure = model.connectedAppFailure {
                    ValidationLine(text: SettingsCopy.connectedAppFailure(failure), tone: .issue)
                }
            } header: {
                Text(SettingsCopy.connectedApps)
            }
            .task { await model.loadConnectedApps() }
            .onDisappear { model.forgetConnectedApps() }
        }
    }

    @ViewBuilder private var list: some View {
        switch model.connectedApps {
        case .none, .loading:
            ProgressView()
                .controlSize(.small)
        case .failed:
            Text(KeyScreenCopy.listFailed)
                .foregroundStyle(.red)
            Button(MainWindowCopy.tryAgain) { Task { await model.loadConnectedApps() } }
        case .loaded:
            if model.visibleConnectedApps.isEmpty {
                Text(SettingsCopy.noConnectedApps)
                    .foregroundStyle(.secondary)
            }
            ForEach(model.visibleConnectedApps) { app in
                ConnectedAppRow(app: app)
            }
        }
    }
}
