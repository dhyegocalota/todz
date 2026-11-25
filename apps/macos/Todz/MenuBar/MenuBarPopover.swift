import SwiftUI
import TodzKit

struct MenuBarPopover: View {
    @Environment(AppModel.self) private var model
    @Environment(MenuBarPanel.self) private var panel
    @Environment(DayCloseCoordinator.self) private var dayClose
    @FocusState private var focus: MenuBarFocus?

    var body: some View {
        screen
            .background(
                MenuBarPanelReader(
                    panel: panel,
                    onBecomeKey: focusAddField,
                    onHide: { dayClose.end() },
                    onWorkspaceNumber: { number in Task { await model.switchWorkspace(number: number) } }
                )
            )
            .task { await model.launch() }
    }

    private func focusAddField() {
        guard !dayClose.isClosingDay else { return }
        Task { focus = .addField }
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
