import TodzKit

enum TaskListState {
    case loading
    case failed
    case empty
    case rows([TaskSection])

    @MainActor static func of(workspace: Workspace, model: AppModel) -> TaskListState {
        let loads = workspace.projects.map { model.projectLoads[$0.identifier] }
        let isFirstLoad = loads.contains(nil)
        guard !isFirstLoad else { return .loading }
        let isNothingLoaded = loads.allSatisfy { $0 == .failed }
        guard !isNothingLoaded else { return .failed }
        let views = TaskViews(projects: workspace.projects, board: model.board, day: model.today, timeZone: model.timeZone)
        let sections = TaskSections.sections(item: model.selectedItem, views: views, today: model.today, timeZone: model.timeZone)
        let isEmpty = sections.allSatisfy { $0.tasks.isEmpty }
        guard !isEmpty else { return .empty }
        return .rows(sections)
    }

    var isFailed: Bool {
        guard case .failed = self else { return false }
        return true
    }
}
