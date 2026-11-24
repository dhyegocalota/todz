import SwiftUI
import TodzKit

private let openSymbol = "circle"
private let doneSymbol = "checkmark.circle.fill"

struct WidgetCheckbox: View {
    let task: WidgetSnapshotTask
    let key: TaskKey

    var body: some View {
        Button(intent: ToggleTaskIntent(key: key, state: task.isDone ? .open : .done)) {
            Image(systemName: task.isDone ? doneSymbol : openSymbol)
                .foregroundStyle(task.isDone ? Color.accentColor : Color.secondary)
        }
        .buttonStyle(.plain)
        .invalidatableContent()
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(.isToggle)
    }

    private var accessibilityLabel: String {
        guard task.isDone else { return AccessibilityCopy.checkboxOpen(title: task.title) }
        return AccessibilityCopy.checkboxDone(title: task.title)
    }
}
