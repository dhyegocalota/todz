import Observation
import SwiftUI
import TodzKit

private let completionLinger: Duration = .seconds(1)

@MainActor @Observable final class MainWindowState {
    var isInspectorPresented = true
    var sheet: NameSheetKind?
    var focusRequest: MainWindowFocus?
    var isConfirmingSignOut = false
    var lingers: [TaskKey: TaskLinger] = [:]
    @ObservationIgnored private var lingerTimers: [TaskKey: Task<Void, Never>] = [:]

    var inspectorToggleTitle: String {
        isInspectorPresented ? MainWindowCopy.hideInspector : MainWindowCopy.showInspector
    }

    func requestNewTask(model: AppModel) {
        let hasNoAddField = model.selectedItem == .upcoming || model.selectedItem == .done
        if hasNoAddField { model.selectedItem = .inbox }
        focusRequest = .addField
    }

    func requestSignOut(model: AppModel) {
        guard model.waitingChangeCount == 0 else {
            isConfirmingSignOut = true
            return
        }
        Task { await model.signOut() }
    }

    func openInspectorTitle() {
        isInspectorPresented = true
        focusRequest = .inspectorTitle
    }

    func toggleDone(task key: TaskKey, model: AppModel) {
        lingerTimers[key]?.cancel()
        lingers[key] = startedLinger(task: key, model: model)
        Task { await model.toggleDone(task: key) }
        guard lingers[key] != nil else { return }
        lingerTimers[key] = Task { await endLinger(task: key) }
    }

    func lingeringTasks(model: AppModel) -> LingeringTasks {
        let entries = lingers
            .filter { $0.value.item == model.selectedItem }
            .sorted { $0.value.index < $1.value.index }
            .compactMap { key, linger in model.boardTask(key).map { (index: linger.index, task: $0) } }
        return LingeringTasks(entries: entries)
    }

    private func startedLinger(task key: TaskKey, model: AppModel) -> TaskLinger? {
        guard let openTasks = model.openListTasks else { return nil }
        let shownTasks = lingeringTasks(model: model).placed(into: openTasks)
        guard let index = shownTasks.firstIndex(where: { $0.key == key && !$0.isDone }) else { return nil }
        return TaskLinger(item: model.selectedItem, index: index)
    }

    private func endLinger(task key: TaskKey) async {
        do {
            try await Task.sleep(for: completionLinger)
        } catch {
            return
        }
        lingerTimers[key] = nil
        let animation: Animation? = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion ? nil : .default
        withAnimation(animation) { lingers[key] = nil }
    }
}
