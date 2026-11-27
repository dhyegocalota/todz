import SwiftUI
import TodzKit

struct TaskDeletionDialog: ViewModifier {
    @Binding var task: BoardTask?
    @Environment(AppModel.self) private var model

    func body(content: Content) -> some View {
        content
            .confirmationDialog(SheetCopy.deleteTaskTitle, isPresented: isPresented, titleVisibility: .visible, presenting: task) { shown in
                Button(SheetCopy.delete, role: .destructive) {
                    Task { await model.delete(task: shown.key) }
                }
                Button(SheetCopy.cancel, role: .cancel) {}
                    .keyboardShortcut(.defaultAction)
            } message: { shown in
                Text(SheetCopy.deleteTaskMessage(title: shown.task.title))
            }
    }

    private var isPresented: Binding<Bool> {
        Binding {
            task != nil
        } set: { isShown in
            guard !isShown else { return }
            task = nil
        }
    }
}

extension View {
    func taskDeletionDialog(task: Binding<BoardTask?>) -> some View {
        modifier(TaskDeletionDialog(task: task))
    }
}
