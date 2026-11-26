import SwiftUI
import TodzKit

struct MenuBarPopover: View {
    @Environment(AppModel.self) private var model
    @Environment(MenuBarPanel.self) private var panel
    @Environment(DayCloseCoordinator.self) private var dayClose
    @Environment(MorningGlanceCoordinator.self) private var morningGlance
    @Environment(RibbonCoordinator.self) private var ribbon
    @FocusState private var focus: MenuBarFocus?

    var body: some View {
        screen
            .background(
                MenuBarPanelReader(
                    panel: panel,
                    onBecomeKey: focusAddField,
                    onShow: showPopover,
                    onHide: endDayClose,
                    onWorkspaceNumber: switchWorkspace
                )
            )
            .task { await model.launch() }
            .onChange(of: dayClose.isClosingDay, initial: true) { _, isClosingDay in clearFocus(isClosingDay: isClosingDay) }
            .onChange(of: model.activeWorkspaceIdentifier) { closeWhenTheDayCloseAsks() }
    }

    private func closeWhenTheDayCloseAsks() {
        guard dayClose.workspaceChanged() else { return }
        panel.close()
    }

    private func showPopover() {
        panel.onShown?()
        dayClose.popoverShown()
        morningGlance.popoverShown()
        ribbon.end()
    }

    private func endDayClose() {
        panel.forgetApplicationBeforeEngaging()
        dayClose.end()
    }

    private func switchWorkspace(number: Int) {
        guard dayClose.acceptsKeyActions else { return }
        Task { await model.switchWorkspace(number: number) }
    }

    private func focusAddField() {
        guard !dayClose.isClosingDay else { return }
        Task { focus = .addField }
    }

    private func clearFocus(isClosingDay: Bool) {
        guard isClosingDay else { return }
        focus = nil
    }

    @ViewBuilder private var screen: some View {
        switch model.phase {
        case .loading:
            MenuBarLoading()
        case let .signedOut(notice):
            MenuBarPrompt(line: signedOutLine(notice: notice))
        case .naming, .choosing:
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
