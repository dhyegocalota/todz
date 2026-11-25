import SwiftUI
import TodzKit

private let maximumPopoverHeight: CGFloat = 520
private let newTaskKey: KeyEquivalent = "n"
private let dayCloseSection = "day-close"
private let dayClosedLinger: Duration = .seconds(2)

struct MenuBarToday: View {
    let workspace: Workspace
    let focus: FocusState<MenuBarFocus?>.Binding
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState
    @Environment(MenuBarPanel.self) private var panel
    @Environment(DayCloseCoordinator.self) private var dayClose
    @State private var pinnedTopHeight: CGFloat = .zero
    @State private var footHeight: CGFloat = .zero

    var body: some View {
        let isClosingDay = dayClose.isClosingDay
        let listState = TaskListState.of(workspace: workspace, item: .today, model: model, lingers: windowState.lingers)
        let state = isClosingDay ? dayCloseState(listState) : listState
        let isDayClosed = isClosingDay && model.isDayClosed(lingers: windowState.lingers)
        let destination = model.addTaskDestination(for: .today)
        VStack(alignment: .leading, spacing: .zero) {
            VStack(alignment: .leading, spacing: .zero) {
                MenuBarHeader(workspace: workspace)
                if let banner = model.banner, !state.isFailed {
                    ErrorBanner(banner: banner)
                }
                if let destination, !state.isFailed {
                    AddTaskField(destination: destination, selection: .keepSelection, focus: focus, focusedValue: .addField, onEscape: closeWhenEmpty)
                        .frame(maxHeight: addFieldMaximumHeight)
                        .clipped()
                        .disabled(isClosingDay)
                        .accessibilityHidden(isClosingDay)
                }
                if case .rows = state, !isDayClosed, let openCount = model.todayHeadingCount {
                    MenuBarTodayHeading(title: isClosingDay ? MenuBarCopy.closeTheDay : MainWindowCopy.today, openCount: openCount)
                }
            }
            .onGeometryChange(for: CGFloat.self, of: \.size.height) { pinnedTopHeight = $0 }
            MenuBarTodayBody(state: state, isDayClosed: isDayClosed, maximumHeight: maximumPopoverHeight - pinnedTopHeight - footHeight)
            MenuBarFoot(doneCount: doneCount(state: state))
                .onGeometryChange(for: CGFloat.self, of: \.size.height) { footHeight = $0 }
        }
        .background {
            Button(MainWindowCopy.newTask) { focus.wrappedValue = .addField }
                .keyboardShortcut(newTaskKey)
                .disabled(isClosingDay)
                .hidden()
        }
        .onExitCommand(perform: escapeAction)
        .onChange(of: isClosingDay, initial: true) { _, isClosingDay in announceOpening(isClosingDay: isClosingDay) }
        .onChange(of: model.activeWorkspaceIdentifier) { dayClose.end() }
        .task(id: isDayClosed) { await closeAfterTheDayClosed(isDayClosed: isDayClosed) }
    }

    private var addFieldMaximumHeight: CGFloat? {
        guard dayClose.isClosingDay else { return nil }
        return .zero
    }

    private var escapeAction: (() -> Void)? {
        guard dayClose.isClosingDay else { return nil }
        return closePanel
    }

    private func dayCloseState(_ state: TaskListState) -> TaskListState {
        guard case .rows = state, let tasks = model.dayCloseTasks(lingers: windowState.lingers), let taskViews = model.taskViews else { return state }
        let section = TaskSection(
            identifier: dayCloseSection,
            title: nil,
            count: nil,
            tasks: tasks,
            pendingTasks: taskViews.pendingTasks(for: .today),
            hasManualOrder: false
        )
        return .rows([section])
    }

    private func closeWhenEmpty(_ escape: AddTaskFieldEscape) {
        guard escape == .wasEmpty else { return }
        panel.close()
    }

    private func closePanel() {
        panel.close()
    }

    private func announceOpening(isClosingDay: Bool) {
        guard isClosingDay, let openCount = model.todayHeadingCount else { return }
        AccessibilityNotification.Announcement(AccessibilityCopy.dayCloseOpened(count: openCount)).post()
    }

    private func closeAfterTheDayClosed(isDayClosed: Bool) async {
        guard isDayClosed else { return }
        AccessibilityNotification.Announcement(MenuBarCopy.dayClosedTitle).post()
        do {
            try await Task.sleep(for: dayClosedLinger)
        } catch {
            return
        }
        panel.close()
    }

    private func doneCount(state: TaskListState) -> Int {
        guard case .rows = state, let taskViews = model.taskViews else { return .zero }
        return taskViews.today.doneToday.count
    }
}
