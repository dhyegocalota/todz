import SwiftUI
import TodzKit

private let checkboxSymbol = "circle"

struct MenuBarDayCloseActions: View {
    let task: BoardTask
    let onAct: (LingerOutcome) -> Void
    @Environment(MainWindowState.self) private var windowState
    @Environment(DayCloseCoordinator.self) private var dayClose

    var body: some View {
        let outcome = windowState.lingers.outcome(of: task.key)
        if outcome != .done {
            HStack {
                Image(systemName: checkboxSymbol)
                    .hidden()
                if let outcome {
                    Text(MenuBarCopy.result(of: outcome))
                }
                if outcome == nil {
                    actionButtons
                }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
    }

    private var actionButtons: some View {
        HStack {
            Button(MenuBarCopy.done) { onAct(.done) }
                .focusable(dayClose.isEngaged)
                .help(MenuBarCopy.doneHelp)
                .accessibilityLabel(AccessibilityCopy.checkboxOpen(title: task.task.title))
            Button(MainWindowCopy.tomorrow) { onAct(.dueTomorrow) }
                .focusable(dayClose.isEngaged)
                .help(MenuBarCopy.tomorrowHelp)
                .accessibilityLabel(AccessibilityCopy.tomorrowLabel(title: task.task.title))
            Button(MenuBarCopy.noDate) { onAct(.noDueDate) }
                .focusable(dayClose.isEngaged)
                .help(MenuBarCopy.noDateHelp)
                .accessibilityLabel(AccessibilityCopy.noDateLabel(title: task.task.title))
        }
        .buttonStyle(.borderless)
    }
}
