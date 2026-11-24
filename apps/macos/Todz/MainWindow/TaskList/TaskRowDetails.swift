import Foundation
import TodzKit

private let spokenSeparator = ", "

struct TaskRowDetails {
    let projectTag: String?
    let dueDate: CalendarDate?
    let actor: String?

    init(task: BoardTask, item: SidebarItem, today: CalendarDate) {
        projectTag = item.isCrossProject ? task.project.name : nil
        dueDate = Self.shownDueDate(task.task.dueDate, item: item, today: today)
        actor = Self.agentLine(task: task)
    }

    init(pendingTask: PendingTask, projectName: String?, item: SidebarItem, today: CalendarDate) {
        projectTag = item.isCrossProject ? projectName : nil
        dueDate = Self.shownDueDate(pendingTask.dueDate, item: item, today: today)
        actor = nil
    }

    var isEmpty: Bool {
        projectTag == nil && dueDate == nil && actor == nil
    }

    @MainActor func spokenValue(state: String, today: CalendarDate, timeZone: TimeZone) -> String {
        let dueText = dueDate.map { DueLabel.text(dueDate: $0, today: today, timeZone: timeZone) }
        return [state, projectTag, dueText, actor].compactMap { $0 }.joined(separator: spokenSeparator)
    }

    private static func shownDueDate(_ dueDate: CalendarDate?, item: SidebarItem, today: CalendarDate) -> CalendarDate? {
        guard let dueDate else { return nil }
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
