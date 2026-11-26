import Observation
import SwiftUI
import TodzKit

private let completionLinger: Duration = .seconds(1)
private let tomorrowOffset = 1

@MainActor @Observable final class MainWindowState {
    var isInspectorPresented = true
    var sheet: NameSheetKind?
    var deletion: DeletionKind?
    var focusRequest: MainWindowFocus?
    var isConfirmingSignOut = false
    var lingers = CompletionLingers()
    var waitingLink: WidgetLink?
    var openingFocus = OpeningFocus.addField
    var addFieldArming = AddFieldArming(opening: .addField)
    var waitingSignInLink: SignInLink?
    var isMainWindowRequested = false
    var agentClient: AgentClient = .claudeCode
    @ObservationIgnored private var lingerTimers: [TaskKey: Task<Void, Never>] = [:]

    var inspectorToggleTitle: String {
        isInspectorPresented ? MainWindowCopy.hideInspector : MainWindowCopy.showInspector
    }

    func requestNewTask(model: AppModel) {
        let hasNoAddField = model.selectedItem == .upcoming || model.selectedItem == .done || model.selectedItem == .connectAgent
        if hasNoAddField { model.selectedItem = .inbox }
        addFieldArming.apply(.newTaskCommand)
        focusRequest = .addField
    }

    func windowClosed() {
        openingFocus = .addField
        addFieldArming = AddFieldArming(opening: .addField)
    }

    func requestSignOut(model: AppModel) {
        guard model.waitingChangeCount == 0 else {
            isConfirmingSignOut = true
            return
        }
        Task { await model.signOut() }
    }

    func open(_ link: WidgetLink, from source: LinkSource) {
        openingFocus = source.openingFocus
        addFieldArming = AddFieldArming(opening: source.openingFocus)
        waitingLink = link
    }

    func follow(_ link: WidgetLink, model: AppModel) {
        waitingLink = nil
        model.follow(link)
    }

    func openInspectorTitle() {
        isInspectorPresented = true
        focusRequest = .inspectorTitle
    }

    func toggleDone(task key: TaskKey, item: SidebarItem, model: AppModel) {
        linger(task: key, with: toggledLingers(task: key, item: item, model: model))
        Task { await model.toggleDone(task: key) }
    }

    func closeDay(task key: TaskKey, outcome: LingerOutcome, model: AppModel) {
        switch outcome {
        case .done: toggleDone(task: key, item: .today, model: model)
        case .dueTomorrow: moveToTomorrow(task: key, model: model)
        case .noDueDate: clearDueDate(task: key, model: model)
        }
    }

    private func moveToTomorrow(task key: TaskKey, model: AppModel) {
        linger(task: key, with: startedLingers(.dueTomorrow, task: key, model: model))
        let tomorrow = model.today.adding(days: tomorrowOffset)
        Task { await model.updateDueDate(task: key, dueDate: tomorrow) }
    }

    private func clearDueDate(task key: TaskKey, model: AppModel) {
        linger(task: key, with: startedLingers(.noDueDate, task: key, model: model))
        Task { await model.updateDueDate(task: key, dueDate: nil) }
    }

    private func linger(task key: TaskKey, with started: CompletionLingers) {
        lingerTimers[key]?.cancel()
        lingers = started
        guard lingers.contains(task: key) else { return }
        lingerTimers[key] = Task { await endLinger(task: key) }
    }

    private func toggledLingers(task key: TaskKey, item: SidebarItem, model: AppModel) -> CompletionLingers {
        guard let taskViews = model.taskViews else { return lingers.ending(task: key) }
        return lingers.toggling(task: key, in: item, views: taskViews)
    }

    private func startedLingers(_ outcome: LingerOutcome, task key: TaskKey, model: AppModel) -> CompletionLingers {
        guard let taskViews = model.taskViews else { return lingers.ending(task: key) }
        return lingers.starting(outcome, task: key, in: .today, views: taskViews)
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
