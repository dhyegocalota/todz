import SwiftUI
import TodzKit

private let maximumPopoverHeight: CGFloat = 520
private let dayClosedLinger: Duration = .seconds(2)

struct MenuBarToday: View {
    let workspace: Workspace
    let focus: FocusState<MenuBarFocus?>.Binding
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState
    @Environment(MenuBarPanel.self) private var panel
    @Environment(DayCloseCoordinator.self) private var dayClose
    @Environment(AppUpdater.self) private var appUpdater: AppUpdater?
    @State private var pinnedTopHeight: CGFloat = .zero

    var body: some View {
        let state = TaskListState.of(workspace: workspace, item: .today, model: model, lingers: windowState.lingers)
        let day = day(of: state)
        let notice = MenuBarNotice(hasBanner: model.banner != nil && !state.isFailed, isOffline: model.syncStatus != .online, hasUpdateNote: appUpdater?.updatedToVersion != nil)
        let destination = model.addTaskDestination(for: .today)
        let isClosingDay = dayClose.isClosingDay
        let isLoaded = day.screen != .loading && day.screen != .failed
        let showsComposer = destination != nil && isLoaded
        VStack(alignment: .leading, spacing: .zero) {
            VStack(alignment: .leading, spacing: .zero) {
                MenuBarHeader(workspace: workspace, day: day, notice: notice)
                strip(notice)
                if let destination, showsComposer {
                    AddTaskField(
                        destination: destination,
                        selection: .keepSelection,
                        focus: focus,
                        focusedValue: .composer,
                        onEscape: closeWhenEmpty,
                        onNavigate: { navigate(direction: $0, day: day, hasComposer: true) }
                    )
                    .frame(maxHeight: composerMaximumHeight)
                        .clipped()
                        .disabled(isClosingDay)
                        .accessibilityHidden(isClosingDay)
                }
            }
            .onGeometryChange(for: CGFloat.self, of: \.size.height) { pinnedTopHeight = $0 }
            MenuBarTodayBody(
                state: state,
                day: day,
                focus: focus,
                navigate: { navigate(direction: $0, day: day, hasComposer: showsComposer && !isClosingDay) },
                maximumHeight: maximumPopoverHeight - pinnedTopHeight
            )
        }
        .background {
            Button(MainWindowCopy.newTask) { focus.wrappedValue = .composer }
                .keyboardShortcut(MenuBarShortcut.newTask)
                .disabled(isClosingDay)
                .hidden()
            Button(MenuBarCopy.upNextHelp) { completeUpNext(day.upNext) }
                .keyboardShortcut(MenuBarShortcut.completeUpNext, modifiers: .command)
                .disabled(isClosingDay || day.upNext == nil)
                .hidden()
        }
        .contentShape(Rectangle())
        .simultaneousGesture(TapGesture().onEnded { engage() })
        .onExitCommand(perform: escapeAction)
        .onChange(of: isClosingDay, initial: true) { _, isClosingDay in announceOpening(isClosingDay: isClosingDay) }
        .onChange(of: day.screen) { _, screen in announceAllDone(screen: screen) }
        .task(id: day.screen == .dayClosed) { await closeAfterTheDayClosed(isDayClosed: day.screen == .dayClosed) }
    }

    @ViewBuilder private func strip(_ notice: MenuBarNotice) -> some View {
        switch notice.strip {
        case .banner:
            if let banner = model.banner {
                ErrorBanner(banner: banner)
            }
        case .offline:
            SyncStatusItem(announcesChanges: false)
                .buttonStyle(.borderless)
                .padding(.horizontal)
                .padding(.vertical, FormMetrics.fieldVerticalPadding)
                .background(.fill.quaternary, in: Capsule())
                .padding(.horizontal)
        case .none:
            EmptyView()
        }
    }

    private var composerMaximumHeight: CGFloat? {
        guard dayClose.isClosingDay else { return nil }
        return .zero
    }

    private var escapeAction: (() -> Void)? {
        guard dayClose.isClosingDay else { return nil }
        return closePanel
    }

    private func day(of state: TaskListState) -> MenuBarDay {
        MenuBarDay(
            open: state.todaySections.prefix(1).flatMap(\.tasks),
            doneToday: state.todaySections.dropFirst().flatMap(\.tasks),
            pendingCount: state.todaySections.flatMap(\.pendingTasks).count,
            isClosingDay: dayClose.isClosingDay,
            load: state.menuBarLoad
        )
    }

    private func navigate(direction: MenuBarDirection, day: MenuBarDay, hasComposer: Bool) {
        let rows = ([day.upNext].compactMap(\.self) + day.queue).map { TaskKey(projectIdentifier: $0.project.identifier, number: $0.task.number) }
        let hasDoneToday = !dayClose.isClosingDay && !day.doneToday.isEmpty
        let targets = MenuBarNavigation.targets(hasComposer: hasComposer, rows: rows, hasDoneToday: hasDoneToday)
        focus.wrappedValue = MenuBarNavigation.next(from: focus.wrappedValue, direction: direction, in: targets)
    }

    private func completeUpNext(_ task: BoardTask?) {
        guard let task else { return }
        windowState.toggleDone(task: task.key, item: .today, model: model)
    }

    private func closeWhenEmpty(_ escape: AddTaskFieldEscape) {
        guard escape == .wasEmpty else { return }
        panel.close()
    }

    private func engage() {
        panel.engage(dayClose)
    }

    private func closePanel() {
        panel.closeReturningToTheApplicationBefore()
    }

    private func announceOpening(isClosingDay: Bool) {
        guard isClosingDay, let openCount = model.todayHeadingCount else { return }
        AccessibilityNotification.Announcement(AccessibilityCopy.dayCloseOpened(count: openCount)).post()
    }

    private func announceAllDone(screen: MenuBarScreen) {
        guard screen == .allDone else { return }
        AccessibilityNotification.Announcement(MenuBarCopy.allDoneTitle).post()
    }

    private func closeAfterTheDayClosed(isDayClosed: Bool) async {
        guard isDayClosed else { return }
        AccessibilityNotification.Announcement(MenuBarCopy.dayClosedTitle).post()
        do {
            try await Task.sleep(for: dayClosedLinger)
        } catch {
            return
        }
        panel.closeReturningToTheApplicationBefore()
    }
}

private extension TaskListState {
    var todaySections: [TaskSection] {
        guard case let .rows(sections) = self else { return [] }
        return sections
    }

    var menuBarLoad: MenuBarLoad {
        switch self {
        case .loading: .loading
        case .failed: .failed
        case .empty, .rows: .loaded
        }
    }
}
