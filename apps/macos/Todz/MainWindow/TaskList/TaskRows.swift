import SwiftUI
import TodzKit

struct TaskRows: View {
    let sections: [TaskSection]
    let item: SidebarItem
    let focus: FocusState<MainWindowFocus?>.Binding
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState

    var body: some View {
        @Bindable var model = model
        ScrollViewReader { proxy in
            List(selection: $model.selectedTask) {
                ForEach(sections) { section in
                    Section {
                        ForEach(section.tasks, id: \.key) { task in
                            TaskRow(task: task, item: item)
                                .tag(task.key)
                        }
                        .onMove(perform: section.hasManualOrder ? { move(section: section, source: $0, offset: $1) } : nil)
                        ForEach(section.pendingTasks, id: \.idempotencyKey) { pendingTask in
                            PendingTaskRow(task: pendingTask, item: item)
                                .selectionDisabled()
                        }
                    } header: {
                        TaskSectionHeader(section: section)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .focused(focus, equals: .list)
            .onKeyPress(.space) {
                toggleSelectedTask()
                return .handled
            }
            .onKeyPress(keys: [.delete, .deleteForward]) { _ in .handled }
            .contextMenu(forSelectionType: TaskKey.self) { _ in
            } primaryAction: { keys in
                guard !keys.isEmpty else { return }
                windowState.openInspectorTitle()
            }
            .onChange(of: model.selectedTask) { _, selectedTask in
                guard let selectedTask else { return }
                Task { proxy.scrollTo(selectedTask) }
            }
        }
    }

    private func toggleSelectedTask() {
        guard let selectedTask = model.selectedTask else { return }
        windowState.toggleDone(task: selectedTask, model: model)
    }

    private func move(section: TaskSection, source: IndexSet, offset: Int) {
        guard let index = source.first else { return }
        guard let placement = CompletionLingers.placement(moving: index, toOffset: offset, in: section.tasks) else { return }
        let moving = section.tasks[index]
        Task { await model.move(task: moving.key, placement: placement) }
    }
}
