import Foundation
import Testing
@testable import TodzKit

private let inbox = Project(identifier: "inbox", name: "Inbox", isInbox: true, createdAt: fixedInstant)
private let launch = Project(identifier: "launch", name: "Launch", isInbox: false, createdAt: fixedInstant)
private let today = CalendarDate(year: 2026, month: 11, day: 24)
private let tomorrow = CalendarDate(year: 2026, month: 11, day: 25)
private let completedAt = fixedInstant.addingTimeInterval(120)
private let earlierCompletion = fixedInstant.addingTimeInterval(-3_600)

private func key(_ number: Int, project: Project = inbox) -> TaskKey {
    TaskKey(projectIdentifier: project.identifier, number: number)
}

private func board(_ tasks: [TaskRecord], project: Project = inbox) -> TaskBoard {
    var board = TaskBoard()
    board.merge(projectIdentifier: project.identifier, tasks: tasks)
    return board
}

private func outbox(_ changes: [PendingChange]) -> Outbox {
    changes.reduce(Outbox()) { outbox, change in outbox.appending(change, isHeadSent: false) }
}

private func views(_ board: TaskBoard) throws -> TaskViews {
    let timeZone = try #require(TimeZone(identifier: "America/Sao_Paulo"))
    return TaskViews(projects: [inbox, launch], board: board, day: today, timeZone: timeZone)
}

private func openTitles(_ board: TaskBoard, project: Project = inbox) throws -> [String] {
    try views(board).project(identifier: project.identifier).map(\.task.title)
}

private func lettered(_ number: Int, title: String) -> TaskRecord {
    MutableTask(number: number, title: title, orderKey: "a\(number)").record
}

@Suite struct TaskBoardOverlayTests {
    @Test(arguments: [
        TaskPatch.title("Call the bank today"),
        .notes("Two copies"),
        .notes(nil),
        .dueDate(tomorrow),
        .dueDate(nil),
    ])
    func aWaitingFieldReplacesThatFieldAlone(patch: TaskPatch) throws {
        var held = MutableTask(number: 1, title: "Call the bank", dueDate: today)
        held.notes = "One copy"
        var expected = held
        switch patch {
        case let .title(title): expected.title = title
        case let .notes(notes): expected.notes = notes
        case let .dueDate(dueDate): expected.dueDate = dueDate
        case .placement: Issue.record("a placement is not a field of the task")
        }
        let applied = board([held.record]).applying(outbox([.field(key(1), patch)]))
        #expect(applied.task(projectIdentifier: inbox.identifier, number: 1) == expected.record)
    }

    @Test func aWaitingDoneMovesTheTaskFromInboxToDoneAtTheClickTime() throws {
        let applied = board([MutableTask(number: 1).record]).applying(outbox([.state(key(1), .done, at: completedAt)]))
        let shown = try views(applied)
        #expect(shown.inbox == [])
        #expect(shown.done.map(\.task.number) == [1])
        #expect(shown.done.first?.task.completedAt == completedAt)
    }

    @Test func aWaitingReopenClearsTheCompletion() throws {
        let held = MutableTask(number: 1, state: .done, completedAt: earlierCompletion).record
        let applied = board([held]).applying(outbox([.state(key(1), .open, at: completedAt)]))
        let reopened = try #require(applied.task(projectIdentifier: inbox.identifier, number: 1))
        #expect(reopened.state == .open)
        #expect(reopened.completedAt == nil)
    }

    @Test func aChangeForATaskTheBoardDoesNotHoldIsIgnored() {
        let held = board([MutableTask(number: 1).record])
        let applied = held.applying(outbox([
            .field(key(9), .title("Gone")),
            .state(key(9), .done, at: completedAt),
            .field(key(9), .placement(.first)),
            .field(key(1, project: launch), .title("Elsewhere")),
        ]))
        #expect(applied == held)
    }

    @Test func pendingAddsLeaveTheBoardAlone() {
        let held = board([MutableTask(number: 1).record])
        let draft = TaskDraft(title: "Read", notes: nil, dueDate: nil, idempotencyKey: "key-1")
        #expect(held.applying(outbox([.add(projectIdentifier: inbox.identifier, draft: draft)])) == held)
    }

    @Test func movesApplyInOutboxOrderEachAgainstTheOrderThePreviousLeft() throws {
        let held = board([lettered(1, title: "X"), lettered(2, title: "Y"), lettered(3, title: "A"), lettered(4, title: "B")])
        let applied = held.applying(outbox([
            .field(key(3), .placement(.after(anchor: 1))),
            .field(key(4), .placement(.after(anchor: 3))),
            .field(key(3), .placement(.first)),
        ]))
        #expect(try openTitles(applied) == ["A", "X", "B", "Y"])
    }

    @Test func aMoveAfterATaskCompletedLaterKeepsTheAnchorsOldPlace() throws {
        let held = board([lettered(1, title: "X"), lettered(2, title: "A"), lettered(3, title: "Y"), lettered(4, title: "B")])
        let applied = held.applying(outbox([.field(key(4), .placement(.after(anchor: 2))), .state(key(2), .done, at: completedAt)]))
        #expect(try openTitles(applied) == ["X", "B", "Y"])
        #expect(try views(applied).done.map(\.task.title) == ["A"])
    }

    @Test func aTaskReopenedAfterAMoveTakesItsPlaceByItsKeyAmongTheMovedTasks() throws {
        let finished = MutableTask(number: 2, title: "Y", state: .done, orderKey: "a2", completedAt: earlierCompletion).record
        let held = board([lettered(1, title: "X"), finished, lettered(3, title: "A"), lettered(4, title: "B")])
        let applied = held.applying(outbox([.field(key(4), .placement(.first)), .state(key(2), .open, at: completedAt)]))
        #expect(try openTitles(applied) == ["B", "X", "Y", "A"])
    }

    @Test func aMoveAfterAMissingAnchorChangesNothing() {
        let held = board([lettered(1, title: "X"), lettered(2, title: "Y"), MutableTask(number: 3, state: .done, completedAt: earlierCompletion).record])
        let applied = held.applying(outbox([.field(key(1), .placement(.after(anchor: 9))), .field(key(1), .placement(.after(anchor: 3)))]))
        #expect(applied == held)
    }

    @Test func aMovedProjectsOpenTasksTakeKeysPaddedToTheDigitsOfTheirCount() {
        let held = board((1...12).map { MutableTask(number: $0, orderKey: "b\($0 + 10)").record })
        let applied = held.applying(outbox([.field(key(12), .placement(.first))]))
        let keyed = applied.tasks(projectIdentifier: inbox.identifier).sorted { $0.orderKey < $1.orderKey }
        #expect(keyed.map(\.number) == [12] + Array(1...11))
        #expect(keyed.map(\.orderKey) == (0...11).map { String(format: "%02d", $0) })
    }

    @Test func doneTasksKeepTheirKeys() {
        let finished = MutableTask(number: 3, state: .done, orderKey: "zz", completedAt: earlierCompletion).record
        let completedLater = lettered(2, title: "Y")
        let held = board([lettered(1, title: "X"), completedLater, finished])
        let applied = held.applying(outbox([.field(key(2), .placement(.first)), .state(key(2), .done, at: completedAt)]))
        #expect(applied.task(projectIdentifier: inbox.identifier, number: 3)?.orderKey == "zz")
        #expect(applied.task(projectIdentifier: inbox.identifier, number: 2)?.orderKey == completedLater.orderKey)
        #expect(applied.task(projectIdentifier: inbox.identifier, number: 1)?.orderKey == "0")
    }

    @Test func onlyTheMovedProjectIsKeyedAgain() {
        var held = board([lettered(1, title: "X"), lettered(2, title: "Y")])
        held.merge(projectIdentifier: launch.identifier, tasks: [lettered(1, title: "L")])
        let applied = held.applying(outbox([.field(key(2), .placement(.first))]))
        #expect(applied.tasks(projectIdentifier: inbox.identifier).map(\.orderKey) == ["1", "0"])
        #expect(applied.tasks(projectIdentifier: launch.identifier) == held.tasks(projectIdentifier: launch.identifier))
    }

    @Test func theBoardHoldsEachProjectsCursor() {
        let held = TaskBoard().setting(cursor: 7, projectIdentifier: inbox.identifier)
        #expect(held.cursor(projectIdentifier: inbox.identifier) == 7)
        #expect(held.cursor(projectIdentifier: launch.identifier) == nil)
        #expect(held.setting(cursor: 9, projectIdentifier: inbox.identifier).cursor(projectIdentifier: inbox.identifier) == 9)
    }
}
