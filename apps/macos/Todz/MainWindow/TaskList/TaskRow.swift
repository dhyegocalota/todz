import SwiftUI
import TodzKit

private let titleLineLimit = 2
private let spokenSeparator = ", "

struct TaskRow: View {
    let task: BoardTask
    let item: SidebarItem
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            TaskCheckbox(task: task)
            VStack(alignment: .leading) {
                Text(task.task.title)
                    .lineLimit(titleLineLimit)
                    .truncationMode(.tail)
                    .strikethrough(task.isDone)
                    .foregroundStyle(task.isDone ? Color.secondary : Color.primary)
                if !details.isEmpty {
                    TaskRowSubline(details: details)
                }
            }
            Spacer()
            Text(TaskRowCopy.shortId(number: task.task.number))
                .monospacedDigit()
                .foregroundStyle(.secondary)
        }
        .disabled(model.isWriting(task: task.key))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(task.task.title)
        .accessibilityValue(spokenValue)
        .accessibilityActions {
            Button(task.isDone ? MainWindowCopy.markNotDone : MainWindowCopy.markDone) {
                Task { await model.toggleDone(task: task.key) }
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

    private var spokenValue: String {
        let state = task.isDone ? AccessibilityCopy.rowValueDone : AccessibilityCopy.rowValueOpen
        let dueText = details.dueDate.map { DueLabel.text(dueDate: $0, today: model.today, timeZone: model.timeZone) }
        return ([state] + details.spokenParts(dueText: dueText)).joined(separator: spokenSeparator)
    }
}
