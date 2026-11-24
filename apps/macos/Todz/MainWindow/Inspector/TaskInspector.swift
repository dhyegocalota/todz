import SwiftUI
import TodzKit

struct TaskInspector: View {
    let task: BoardTask
    let focus: FocusState<MainWindowFocus?>.Binding
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(alignment: .leading) {
                HStack(alignment: .firstTextBaseline) {
                    TaskCheckbox(task: task, item: model.selectedItem)
                    TitleField(task: task, focus: focus)
                    Text(TaskRowCopy.shortId(number: task.task.number))
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
                TaskProperties(task: task)
                Divider()
                InspectorSectionTitle(title: InspectorCopy.notes)
                NotesEditor(task: task, unsavedNotes: model.unsavedNotes[task.key])
                Divider()
                InspectorSectionTitle(title: InspectorCopy.history)
                HistoryList(task: task)
            }
            .padding()
        }
        .task(id: task.task.updatedAt) {
            await model.loadHistory(task: task.key)
        }
    }
}
