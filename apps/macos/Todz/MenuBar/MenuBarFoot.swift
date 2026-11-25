import SwiftUI
import TodzKit

private let fewestWorkspacesToSwitch = 2

struct MenuBarFoot: View {
    let doneCount: Int
    @Environment(AppModel.self) private var model

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
            Spacer()
            if canSwitchWorkspace {
                Text(MenuBarCopy.switchHint(last: WorkspaceShortcuts.lastNumber(of: model.workspaces)))
            }
            MenuBarQuitButton()
        }
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .padding()
    }
}
