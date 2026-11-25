import SwiftUI
import TodzKit

private let dayCloseOutcomes: [String: LingerOutcome] = ["d": .done, "t": .dueTomorrow, "n": .noDueDate]

struct MenuBarRow: View {
    let task: BoardTask
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState
    @Environment(MenuBarPanel.self) private var panel
    @Environment(DayCloseCoordinator.self) private var dayClose
    @Environment(\.openWindow) private var openWindow
    @State private var isHovered = false

    var body: some View {
        VStack(alignment: .leading) {
            TaskRow(task: task, item: .today)
                .accessibilityHint(AccessibilityCopy.rowOpensWindow)
                .accessibilityAction(.default, reveal)
                .accessibilityActions {
                    if isActing {
                        Button(AccessibilityCopy.tomorrowLabel(title: task.task.title)) { act(.dueTomorrow) }
                        Button(AccessibilityCopy.noDateLabel(title: task.task.title)) { act(.noDueDate) }
                    }
                }
            if dayClose.isClosingDay {
                MenuBarDayCloseActions(task: task, onAct: act)
            }
        }
        .padding(.horizontal)
        .contentShape(Rectangle())
        .background {
            if isHovered {
                Rectangle()
                    .fill(.fill.quaternary)
            }
        }
        .onHover { isHovered = $0 }
        .onTapGesture(perform: reveal)
        .focusable()
        .onKeyPress(keys: [.return, .space]) { _ in
            guard dayClose.acceptsKeyActions else { return .ignored }
            reveal()
            return .handled
        }
        .onKeyPress(characters: CharacterSet(charactersIn: dayCloseOutcomes.keys.joined())) { press in
            let isUnmodified = press.modifiers.isEmpty
            guard isActing, isUnmodified, dayClose.acceptsKeyActions, let outcome = dayCloseOutcomes[press.characters] else { return .ignored }
            act(outcome)
            return .handled
        }
    }

    private var isActing: Bool {
        let isLingering = windowState.lingers.outcome(of: task.key) != nil
        return dayClose.isClosingDay && !task.isDone && !isLingering
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
