import SwiftUI
import TodzKit

private let moreSymbol = "ellipsis"

struct MenuBarMoreMenu: View {
    let showsUpdateDot: Bool
    @Environment(AppUpdater.self) private var appUpdater: AppUpdater?
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState
    @Environment(MenuBarPanel.self) private var panel
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Menu {
            Button(WorkspaceLockCopy.switchWorkspace) { switchWorkspace() }
                .keyboardShortcut(MenuBarShortcut.switchWorkspace)
                .disabled(!model.isReady && model.phase != .choosing)
            Divider()
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
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .fixedSize()
        .foregroundStyle(.secondary)
        .overlay(alignment: .topTrailing) { updateDot }
        .help(MenuBarCopy.more)
        .accessibilityLabel(MenuBarCopy.more)
        .accessibilityValue(accessibilityState)
    }

    private func switchWorkspace() {
        panel.openMainWindow(openWindow)
        windowState.requestWorkspaceChoice(model: model)
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
