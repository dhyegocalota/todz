import SwiftUI
import TodzKit

private let fewestWorkspacesToSwitch = 2

struct MenuBarFoot: View {
    let doneCount: Int
    @Environment(AppModel.self) private var model
    @Environment(AppUpdater.self) private var appUpdater: AppUpdater?

    var body: some View {
        let isOffline = model.syncStatus != .online
        let showsDoneCount = !isOffline && doneCount > 0
        let canSwitchWorkspace = model.workspaces.count >= fewestWorkspacesToSwitch
        HStack {
            if isOffline {
                SyncStatusItem(announcesChanges: false)
                    .buttonStyle(.borderless)
            }
            if showsDoneCount {
                Text(MenuBarCopy.doneToday(count: doneCount))
            }
            if let appUpdater, let updatedVersion = appUpdater.updatedToVersion {
                Button(UpdateCopy.updatedTo(version: updatedVersion)) { appUpdater.acknowledgeUpdate() }
                    .buttonStyle(.borderless)
            }
            Spacer()
            if canSwitchWorkspace {
                Text(MenuBarCopy.switchHint(last: WorkspaceShortcuts.lastNumber(of: model.workspaces)))
            }
            if let appUpdater {
                Button(UpdateCopy.checkForUpdates) { appUpdater.checkForUpdates() }
                    .buttonStyle(.borderless)
                    .disabled(!appUpdater.canCheckForUpdates)
            }
            MenuBarQuitButton()
        }
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .padding()
    }
}
