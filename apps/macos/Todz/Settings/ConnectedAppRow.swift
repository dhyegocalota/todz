import SwiftUI
import TodzKit

struct ConnectedAppRow: View {
    let app: ConnectedApp
    @Environment(AppModel.self) private var model
    @State private var isConfirmingDisconnect = false

    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(app.clientName)
                Text(summary)
                    .settingsDetail()
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(app.clientName)
            .accessibilityValue(summary)
            Spacer()
            FormButton(title: SettingsCopy.disconnectConnectedApp, busyTitle: nil, kind: .secondary, isBusy: model.isChangingConnectedApps, disabledReason: nil) {
                isConfirmingDisconnect = true
            }
            .accessibilityLabel(SettingsCopy.disconnectConnectedAppTitle(clientName: app.clientName))
        }
        .confirmationDialog(SettingsCopy.disconnectConnectedAppTitle(clientName: app.clientName), isPresented: $isConfirmingDisconnect, titleVisibility: .visible) {
            Button(SettingsCopy.disconnectConnectedApp, role: .destructive) {
                Task { await model.disconnectConnectedApp(app) }
            }
            Button(SheetCopy.cancel, role: .cancel) {}
                .keyboardShortcut(.defaultAction)
        } message: {
            Text(SettingsCopy.disconnectConnectedAppMessage)
        }
    }

    private var summary: String {
        SettingsCopy.connectedAppSummary(scope: SettingsCopy.connectedAppScope(app.scope), redirectHost: app.redirectHost, lastUsed: lastUsed)
    }

    private var lastUsed: String {
        DayFormat.moment(instant: app.lastUsedAt, timeZone: model.timeZone)
    }
}
