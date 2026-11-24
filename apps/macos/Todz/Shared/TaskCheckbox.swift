import SwiftUI
import TodzKit

private let openSymbol = "circle"
private let doneSymbol = "checkmark.circle.fill"

struct TaskCheckbox: View {
    let task: BoardTask
    @Environment(AppModel.self) private var model

    var body: some View {
        if model.isWriting(task: task.key) {
            ProgressView()
                .controlSize(.small)
        }
        if !model.isWriting(task: task.key) {
            Button {
                Task { await model.toggleDone(task: task.key) }
            } label: {
                Image(systemName: task.isDone ? doneSymbol : openSymbol)
                    .foregroundStyle(task.isDone ? Color.accentColor : Color.secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(accessibilityLabel)
            .accessibilityAddTraits(.isToggle)
        }
    }

    private var accessibilityLabel: String {
        guard task.isDone else { return AccessibilityCopy.checkboxOpen(title: task.task.title) }
        return AccessibilityCopy.checkboxDone(title: task.task.title)
    }
}
