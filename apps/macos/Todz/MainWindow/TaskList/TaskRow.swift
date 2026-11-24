import SwiftUI
import TodzKit

struct TaskRow: View {
    let task: BoardTask
    let item: SidebarItem
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            TaskCheckbox(task: task, item: item)
            VStack(alignment: .leading) {
                TaskRowTitle(title: task.task.title, isDone: task.isDone)
                if !details.isEmpty {
                    TaskRowSubline(details: details)
                }
            }
            Spacer()
            Text(TaskRowCopy.shortId(number: task.task.number))
                .monospacedDigit()
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(task.task.title)
        .accessibilityValue(details.spokenValue(state: spokenState, today: model.today, timeZone: model.timeZone))
        .accessibilityActions {
            Button(task.isDone ? MainWindowCopy.markNotDone : MainWindowCopy.markDone) {
                windowState.toggleDone(task: task.key, item: item, model: model)
            }
            if item.hasManualOrder {
                Button(MainWindowCopy.moveUp) {
                    Task { await model.move(task: task.key, direction: .up) }
                }
                Button(MainWindowCopy.moveDown) {
                    Task { await model.move(task: task.key, direction: .down) }
                }
            }
        }
    }

    private var details: TaskRowDetails {
        TaskRowDetails(task: task, item: item, today: model.today)
    }

    private var spokenState: String {
        task.isDone ? AccessibilityCopy.rowValueDone : AccessibilityCopy.rowValueOpen
    }
}
