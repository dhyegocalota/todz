import SwiftUI
import TodzKit

private let refreshSymbol = "arrow.clockwise"

struct RefreshButton: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if model.isRefreshing {
            ProgressView()
                .controlSize(.small)
                .accessibilityLabel(AccessibilityCopy.refreshing)
        }
        if !model.isRefreshing {
            Button {
                Task { await model.refresh() }
            } label: {
                Label(MainWindowCopy.refresh, systemImage: refreshSymbol)
            }
            .help(MainWindowCopy.refresh)
        }
    }
}
