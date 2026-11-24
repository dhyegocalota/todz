import SwiftUI
import TodzKit

struct TaskMenuItems: View {
    let model: AppModel
    let windowState: MainWindowState

    var body: some View {
        Button(markTitle) {
            guard let selectedTask = model.selectedTask else { return }
            windowState.toggleDone(task: selectedTask, model: model)
        }
        .keyboardShortcut(.return, modifiers: .command)
        .disabled(!canToggle)
        Button(MainWindowCopy.moveUp) { move(.up) }
            .keyboardShortcut(.upArrow, modifiers: [.command, .option])
            .disabled(!canMove(.up))
        Button(MainWindowCopy.moveDown) { move(.down) }
            .keyboardShortcut(.downArrow, modifiers: [.command, .option])
            .disabled(!canMove(.down))
    }

    private var markTitle: String {
        guard let selectedBoardTask = model.selectedBoardTask else { return MainWindowCopy.markDone }
        guard selectedBoardTask.isDone else { return MainWindowCopy.markDone }
        return MainWindowCopy.markNotDone
    }

    private var canToggle: Bool {
        guard model.isReady, let selectedTask = model.selectedTask else { return false }
        return model.boardTask(selectedTask) != nil
    }

    private func canMove(_ direction: TaskMoveDirection) -> Bool {
        guard model.isReady, let selectedTask = model.selectedTask else { return false }
        return model.placement(task: selectedTask, direction: direction) != nil
    }

    private func move(_ direction: TaskMoveDirection) {
        guard let selectedTask = model.selectedTask else { return }
        Task { await model.move(task: selectedTask, direction: direction) }
    }
}
