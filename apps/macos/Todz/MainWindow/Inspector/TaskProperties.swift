import SwiftUI
import TodzKit

struct TaskProperties: View {
    let task: BoardTask
    @Environment(AppModel.self) private var model

    var body: some View {
        Grid(alignment: .leadingFirstTextBaseline) {
            GridRow {
                label(InspectorCopy.project)
                Text(task.project.name)
            }
            GridRow {
                label(InspectorCopy.due)
                DueDatePicker(task: task)
            }
            if let addedLine {
                GridRow {
                    label(InspectorCopy.added)
                    Text(addedLine)
                }
            }
            if let completedAt = task.task.completedAt {
                GridRow {
                    label(InspectorCopy.completed)
                    Text(DayFormat.moment(instant: completedAt, timeZone: model.timeZone))
                }
            }
        }
        .font(.callout)
    }

    private var addedLine: String? {
        guard let source = ChangeSource(task.task.createdBy) else { return nil }
        let time = DayFormat.moment(instant: task.task.createdAt, timeZone: model.timeZone)
        return source.line(owner: InspectorCopy.byYou(time: time)) { InspectorCopy.viaClient(time: time, client: $0) }
    }

    private func label(_ text: String) -> some View {
        Text(text)
            .foregroundStyle(.secondary)
            .gridColumnAlignment(.trailing)
    }
}
