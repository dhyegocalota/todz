import SwiftUI
import TodzKit

private let offlineSymbol = "wifi.slash"

struct SyncStatusItem: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if case let .offline(waiting) = model.syncStatus {
            Button {
                Task { await model.refresh() }
            } label: {
                Label(Self.text(waiting: waiting), systemImage: offlineSymbol)
            }
            .labelStyle(.titleAndIcon)
            .foregroundStyle(.secondary)
            .help(SyncCopy.offlineHelp)
            .accessibilityHint(SyncCopy.offlineHelp)
            .onAppear(perform: announce)
        }
    }

    private func announce() {
        AccessibilityNotification.Announcement(SyncCopy.offline).post()
    }

    private static func text(waiting: Int) -> String {
        guard waiting > 0 else { return SyncCopy.offline }
        return SyncCopy.offlineWaiting(count: waiting)
    }
}
