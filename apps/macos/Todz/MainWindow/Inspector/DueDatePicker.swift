import SwiftUI
import TodzKit

struct DueDatePicker: View {
    let task: BoardTask
    @Environment(AppModel.self) private var model
    @State private var pickedDate: Date?

    var body: some View {
        VStack(alignment: .leading) {
            Button(action: open) {
                if let dueDate = task.task.dueDate {
                    DueLabel(dueDate: dueDate)
                }
                if task.task.dueDate == nil {
                    Text(InspectorCopy.noDueDate)
                }
            }
            .buttonStyle(.link)
            .popover(isPresented: isPresented) {
                DueDatePopover(pickedDate: pickedDate, hasDueDate: task.task.dueDate != nil, pick: pick, clear: clear)
            }
            if let issue = model.ruleIssue(task: task.key, field: .dueDate) {
                Text(issue.copy)
                    .foregroundStyle(.red)
            }
        }
    }

    private var isPresented: Binding<Bool> {
        Binding {
            pickedDate != nil
        } set: { isShown in
            guard !isShown else { return }
            pickedDate = nil
        }
    }

    private func open() {
        guard let dueDate = task.task.dueDate else {
            pickedDate = model.today.start(in: model.timeZone)
            return
        }
        pickedDate = dueDate.start(in: model.timeZone)
    }

    private func pick(_ date: Date) {
        save(dueDate: CalendarDate.today(in: model.timeZone, at: date))
    }

    private func clear() {
        save(dueDate: nil)
    }

    private func save(dueDate: CalendarDate?) {
        pickedDate = nil
        guard dueDate != task.task.dueDate else { return }
        Task { await model.updateDueDate(task: task.key, dueDate: dueDate) }
    }
}
