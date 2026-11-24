import SwiftUI
import TodzKit

struct MenuBarPopover: View {
    @Environment(AppModel.self) private var model
    @State private var panel = MenuBarPanel()
    @FocusState private var focus: MenuBarFocus?

    var body: some View {
        screen
            .environment(panel)
            .background(
                MenuBarPanelReader(
                    panel: panel,
                    onBecomeKey: { Task { focus = .addField } },
                    onWorkspaceNumber: { number in Task { await model.switchWorkspace(number: number) } }
                )
            )
            .task { await model.launch() }
    }

    @ViewBuilder private var screen: some View {
        switch model.phase {
        case .loading:
            MenuBarLoading()
        case let .signedOut(notice):
            MenuBarPrompt(line: signedOutLine(notice: notice))
        case .naming:
            MenuBarPrompt(line: MenuBarCopy.naming)
        case .ready:
            if let workspace = model.activeWorkspace {
                MenuBarToday(workspace: workspace, focus: $focus)
            }
        }
    }

    private func signedOutLine(notice: SignInNotice?) -> String {
        let waitingChangeCount = model.waitingChangeCount
        guard waitingChangeCount == 0 else { return SignInCopy.sessionEndedWaiting(count: waitingChangeCount) }
        guard let notice else { return MenuBarCopy.signedOut }
        return notice.copy
    }
}
