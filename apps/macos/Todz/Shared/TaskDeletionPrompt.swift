import AppKit
import TodzKit

@MainActor enum TaskDeletionPrompt {
    static func confirm(_ task: BoardTask, model: AppModel) {
        let wording = TaskDeletionAlert.Wording(
            title: SheetCopy.deleteTaskTitle,
            message: SheetCopy.deleteTaskMessage(title: task.task.title),
            delete: SheetCopy.delete,
            cancel: SheetCopy.cancel
        )
        let response = TaskDeletionAlert.make(wording).runModal()
        guard TaskDeletionAlert.isDeletion(response) else { return }
        Task { await model.delete(task: task.key) }
    }
}
