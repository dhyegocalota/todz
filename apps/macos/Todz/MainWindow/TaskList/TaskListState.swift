import TodzKit

enum TaskListState {
    case loading
    case failed(AppBanner)
    case empty
    case rows([TaskSection])

    @MainActor static func of(workspace: Workspace, model: AppModel, lingers: CompletionLingers) -> TaskListState {
        let loads = workspace.projects.map { model.projectLoads[$0.identifier] }
        let isFirstLoad = loads.contains(nil)
        guard !isFirstLoad else { return .loading }
        if let loadFailure = model.loadFailure(of: workspace) { return .failed(loadFailure) }
        guard let views = model.taskViews else { return .loading }
        let sections = TaskSections.sections(
            item: model.selectedItem,
            views: views,
            lingers: lingers,
            today: model.today,
            timeZone: model.timeZone
        )
        let isEmpty = sections.allSatisfy(\.isEmpty)
        guard !isEmpty else { return .empty }
        return .rows(sections)
    }

    var isFailed: Bool {
        guard case .failed = self else { return false }
        return true
    }
}
