import SwiftUI
import TodzKit

private let dayCloseOutcomes: [String: LingerOutcome] = ["d": .done, "t": .dueTomorrow, "n": .noDueDate]

struct MenuBarRow: View {
    let task: BoardTask
    let isUpNext: Bool
    let focus: FocusState<MenuBarFocus?>.Binding
    let navigate: (MenuBarDirection) -> Void
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState
    @Environment(MenuBarPanel.self) private var panel
    @Environment(DayCloseCoordinator.self) private var dayClose
    @Environment(\.openWindow) private var openWindow
    @State private var isHovered = false

    var body: some View {
        padded
            .background(isShaded ? AnyShapeStyle(.fill.quaternary) : AnyShapeStyle(Color.clear), in: shape)
            .overlay { shape.strokeBorder(Color.accentColor, lineWidth: FormMetrics.focusRingWidth).opacity(isFocused ? 1 : 0) }
            .todzMotion(.focus, value: isFocused)
            .todzMotion(.hover, value: isHovered)
            .padding(.horizontal)
            .contentShape(Rectangle())
            .onHover { isHovered = $0 }
            .onTapGesture(perform: reveal)
            .focusable()
            .focused(focus, equals: .row(task.key))
            .focusEffectDisabled()
            .onKeyPress(.return) {
                guard dayClose.acceptsKeyActions else { return .ignored }
                reveal()
                return .handled
            }
            .onKeyPress(.space) {
                guard dayClose.acceptsKeyActions else { return .ignored }
                complete()
                return .handled
            }
            .onKeyPress(keys: [.upArrow, .downArrow]) { press in
                navigate(press.key == .upArrow ? .up : .down)
                return .handled
            }
            .onKeyPress(characters: CharacterSet(charactersIn: dayCloseOutcomes.keys.joined())) { press in
                let isActionable = isActing && press.modifiers.isEmpty && dayClose.acceptsKeyActions
                guard isActionable, let outcome = dayCloseOutcomes[press.characters] else { return .ignored }
                act(outcome)
                return .handled
            }
    }

    @ViewBuilder private var padded: some View {
        if isUpNext {
            stack.padding()
        }
        if !isUpNext {
            stack
                .padding(.horizontal, FormMetrics.fieldHorizontalPadding)
                .padding(.vertical, FormMetrics.fieldVerticalPadding)
        }
    }

    private var stack: some View {
        VStack(alignment: .leading) {
            line
            if dayClose.isClosingDay {
                MenuBarDayCloseActions(task: task, onAct: act)
            }
        }
    }

    private var line: some View {
        HStack(alignment: .firstTextBaseline) {
            TaskCheckbox(task: task, item: .today)
                .font(isUpNext ? .title2 : .body)
            VStack(alignment: .leading) {
                TaskRowTitle(title: task.task.title, isDone: task.isDone)
                    .font(isUpNext ? .headline : .body)
                if meta.hasSubline {
                    MenuBarRowMetaLine(meta: meta)
                }
            }
            Spacer()
            if let agentName = meta.agentName {
                MenuBarAgentMark(agentName: agentName)
            }
            Text(TaskRowCopy.shortId(number: task.task.number))
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .opacity(isHovered || isFocused ? 1 : 0)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(task.task.title)
        .accessibilityValue(meta.spokenValue(state: spokenState, today: model.today, timeZone: model.timeZone))
        .accessibilityHint(AccessibilityCopy.rowOpensWindow)
        .accessibilityAction(.default, reveal)
        .accessibilityActions {
            Button(task.isDone ? MainWindowCopy.markNotDone : MainWindowCopy.markDone, action: toggleDone)
            if isActing {
                Button(AccessibilityCopy.tomorrowLabel(title: task.task.title)) { act(.dueTomorrow) }
                Button(AccessibilityCopy.noDateLabel(title: task.task.title)) { act(.noDueDate) }
            }
        }
    }

    private var meta: MenuBarRowMeta {
        MenuBarRowMeta(task: task, today: model.today, shownWorkspaceCount: model.shownWorkspaces.count)
    }

    private var spokenState: String {
        guard !task.isDone else { return AccessibilityCopy.rowValueDone }
        return isUpNext ? MenuBarCopy.upNext : AccessibilityCopy.rowValueOpen
    }

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: FormMetrics.fieldCornerRadius, style: .continuous)
    }

    private var isShaded: Bool {
        isUpNext || isHovered
    }

    private var isFocused: Bool {
        focus.wrappedValue == .row(task.key)
    }

    private var isActing: Bool {
        let isLingering = windowState.lingers.outcome(of: task.key) != nil
        return dayClose.isClosingDay && !task.isDone && !isLingering
    }

    private func complete() {
        guard dayClose.isClosingDay else {
            toggleDone()
            return
        }
        guard isActing else { return }
        act(.done)
    }

    private func toggleDone() {
        windowState.toggleDone(task: task.key, item: .today, model: model)
    }

    private func act(_ outcome: LingerOutcome) {
        windowState.closeDay(task: task.key, outcome: outcome, model: model)
        AccessibilityNotification.Announcement(AccessibilityCopy.announcement(of: outcome)).post()
    }

    private func reveal() {
        model.reveal(task: task.key)
        windowState.isInspectorPresented = true
        panel.openMainWindow(openWindow)
    }
}
