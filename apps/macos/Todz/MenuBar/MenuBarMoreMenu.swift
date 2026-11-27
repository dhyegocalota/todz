import SwiftUI
import TodzKit

private let moreSymbol = "ellipsis"

struct MenuBarMoreMenu: View {
    let showsUpdateDot: Bool
    @Environment(AppUpdater.self) private var appUpdater: AppUpdater?

    var body: some View {
        Menu {
            if let appUpdater, let updatedVersion = appUpdater.updatedToVersion {
                Button(UpdateCopy.updatedTo(version: updatedVersion)) { appUpdater.acknowledgeUpdate() }
            }
            if let appUpdater {
                Button(UpdateCopy.checkForUpdates) { appUpdater.checkForUpdates() }
                    .disabled(!appUpdater.canCheckForUpdates)
            }
            Divider()
            StarRepositoryButton()
            Divider()
            MenuBarQuitButton()
        } label: {
            Image(systemName: moreSymbol)
                .overlay(alignment: .topTrailing) { updateDot }
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .fixedSize()
        .foregroundStyle(.secondary)
        .help(MenuBarCopy.more)
        .accessibilityLabel(MenuBarCopy.more)
        .accessibilityValue(accessibilityState)
    }

    @ViewBuilder private var updateDot: some View {
        if showsUpdateDot {
            Circle()
                .fill(Color.accentColor)
                .frame(width: MenuBarMetrics.updateDotDiameter, height: MenuBarMetrics.updateDotDiameter)
                .accessibilityHidden(true)
        }
    }

    private var accessibilityState: String {
        showsUpdateDot ? MenuBarCopy.updateAvailable : ""
    }
}
