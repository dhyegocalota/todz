import Observation
import SwiftUI
import TodzKit

private let completionLinger: Duration = .seconds(1)

@MainActor @Observable final class MainWindowState {
    var isInspectorPresented = true
    var sheet: NameSheetKind?
    var focusRequest: MainWindowFocus?
    var isConfirmingSignOut = false
    var lingers = CompletionLingers()
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

    func toggleDone(task key: TaskKey, item: SidebarItem, model: AppModel) {
        lingerTimers[key]?.cancel()
        lingers = toggledLingers(task: key, item: item, model: model)
        Task { await model.toggleDone(task: key) }
        guard lingers.contains(task: key) else { return }
        lingerTimers[key] = Task { await endLinger(task: key) }
    }

    private func toggledLingers(task key: TaskKey, item: SidebarItem, model: AppModel) -> CompletionLingers {
        guard let taskViews = model.taskViews else { return lingers.ending(task: key) }
        return lingers.toggling(task: key, in: item, views: taskViews)
    }

    private func endLinger(task key: TaskKey) async {
        do {
            try await Task.sleep(for: completionLinger)
        } catch {
            return
        }
        lingerTimers[key] = nil
        let animation: Animation? = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion ? nil : .default
        withAnimation(animation) { lingers = lingers.ending(task: key) }
    }
}
