import SwiftUI

struct DueDatePopover: View {
    let pickedDate: Date?
    let hasDueDate: Bool
    let pick: (Date) -> Void
    let clear: () -> Void

    var body: some View {
        VStack {
            if let pickedDate {
                DatePicker(InspectorCopy.due, selection: Binding { pickedDate } set: { pick($0) }, displayedComponents: .date)
                    .datePickerStyle(.graphical)
                    .labelsHidden()
            }
            Button(InspectorCopy.clearDueDate, action: clear)
                .disabled(!hasDueDate)
        }
        .padding()
    }
}
