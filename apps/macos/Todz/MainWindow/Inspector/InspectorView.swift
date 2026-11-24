import SwiftUI
import TodzKit

private let noSelectionSymbol = "checklist"
private let goneSymbol = "questionmark.square.dashed"

struct InspectorView: View {
    let focus: FocusState<MainWindowFocus?>.Binding
    @Environment(AppModel.self) private var model

    var body: some View {
        if let selectedTask = model.selectedTask, let task = model.boardTask(selectedTask) {
            TaskInspector(task: task, focus: focus)
                .id(selectedTask)
        }
        if model.selectedTask == nil {
            ContentUnavailableView(InspectorCopy.noSelection, systemImage: noSelectionSymbol, description: Text(InspectorCopy.noSelectionBody))
        }
        if isGone {
            ContentUnavailableView(ErrorCopy.taskGone, systemImage: goneSymbol)
        }
    }

    private var isGone: Bool {
        guard let selectedTask = model.selectedTask else { return false }
        return model.boardTask(selectedTask) == nil
    }
}
