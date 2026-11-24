import TodzKit

struct TaskRowDetails {
    let projectTag: String?
    let dueDate: CalendarDate?
    let actor: String?

    init(task: BoardTask, item: SidebarItem, today: CalendarDate) {
        projectTag = item.isCrossProject ? task.project.name : nil
        dueDate = Self.shownDueDate(task: task, item: item, today: today)
        actor = Self.agentLine(task: task)
    }

    var isEmpty: Bool {
        projectTag == nil && dueDate == nil && actor == nil
    }

    func spokenParts(dueText: String?) -> [String] {
        [projectTag, dueText, actor].compactMap { $0 }
    }

    private static func shownDueDate(task: BoardTask, item: SidebarItem, today: CalendarDate) -> CalendarDate? {
        guard let dueDate = task.task.dueDate else { return nil }
        let isSaidByTheGroupHeader = item == .upcoming
        let isSaidByTheView = item == .today && dueDate == today
        guard !isSaidByTheGroupHeader, !isSaidByTheView else { return nil }
        return dueDate
    }

    private static func agentLine(task: BoardTask) -> String? {
        guard case let .agent(clientName) = task.task.createdBy else { return nil }
        return TaskRowCopy.via(client: clientName)
    }
}
