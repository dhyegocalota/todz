import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "inbox"
private let launchIdentifier = "launch"
private let older = fixedInstant
private let newer = fixedInstant.addingTimeInterval(60)

private func task(number: Int, title: String, updatedAt: Date) -> TaskRecord {
    MutableTask(number: number, title: title, updatedAt: updatedAt).record
}

@Suite struct TaskBoardTests {
    @Test func anEmptyBoardHoldsNoTasks() {
        #expect(TaskBoard().tasks(projectIdentifier: inboxIdentifier) == [])
    }

    @Test func mergesAPageByTaskNumber() {
        var board = TaskBoard()
        board.merge(projectIdentifier: inboxIdentifier, tasks: [task(number: 2, title: "Two", updatedAt: older), task(number: 1, title: "One", updatedAt: older)])
        board.merge(projectIdentifier: inboxIdentifier, tasks: [task(number: 3, title: "Three", updatedAt: older)])
        #expect(board.tasks(projectIdentifier: inboxIdentifier).map(\.number) == [1, 2, 3])
        #expect(board.task(projectIdentifier: inboxIdentifier, number: 2)?.title == "Two")
    }

    @Test func keepsTheNumbersOrderedWhateverTheOrderOfArrival() {
        var board = TaskBoard()
        [5, 1, 3, 4, 2, 3].forEach { board.replace(projectIdentifier: inboxIdentifier, task: task(number: $0, title: "T\($0)", updatedAt: older)) }
        #expect(board.tasks(projectIdentifier: inboxIdentifier).map(\.number) == [1, 2, 3, 4, 5])
    }

    @Test func twoBoardsWithTheSameTasksAreEqualWhateverTheOrderOfArrival() {
        var ascending = TaskBoard()
        var descending = TaskBoard()
        (1...3).forEach { ascending.replace(projectIdentifier: inboxIdentifier, task: task(number: $0, title: "T", updatedAt: older)) }
        (1...3).reversed().forEach { descending.replace(projectIdentifier: inboxIdentifier, task: task(number: $0, title: "T", updatedAt: older)) }
        #expect(ascending == descending)
    }

    @Test func aNewerCopyReplacesTheHeldOne() {
        var board = TaskBoard()
        board.merge(projectIdentifier: inboxIdentifier, tasks: [task(number: 1, title: "Old", updatedAt: older)])
        board.merge(projectIdentifier: inboxIdentifier, tasks: [task(number: 1, title: "New", updatedAt: newer)])
        #expect(board.tasks(projectIdentifier: inboxIdentifier).map(\.title) == ["New"])
    }

    @Test func aCopyAsOldAsTheHeldOneReplacesIt() {
        var board = TaskBoard()
        board.merge(projectIdentifier: inboxIdentifier, tasks: [task(number: 1, title: "First", updatedAt: older)])
        board.merge(projectIdentifier: inboxIdentifier, tasks: [task(number: 1, title: "Second", updatedAt: older)])
        #expect(board.tasks(projectIdentifier: inboxIdentifier).map(\.title) == ["Second"])
    }

    @Test func anOlderCopyNeverReplacesANewerOne() {
        var board = TaskBoard()
        board.merge(projectIdentifier: inboxIdentifier, tasks: [task(number: 1, title: "New", updatedAt: newer)])
        board.merge(projectIdentifier: inboxIdentifier, tasks: [task(number: 1, title: "Stale page", updatedAt: older)])
        board.replace(projectIdentifier: inboxIdentifier, task: task(number: 1, title: "Late answer", updatedAt: older))
        #expect(board.tasks(projectIdentifier: inboxIdentifier).map(\.title) == ["New"])
    }

    @Test func replaceHoldsTheAnsweredTaskInItsProjectOnly() {
        var board = TaskBoard()
        board.merge(projectIdentifier: launchIdentifier, tasks: [task(number: 1, title: "Launch", updatedAt: older)])
        board.replace(projectIdentifier: inboxIdentifier, task: task(number: 1, title: "Inbox", updatedAt: newer))
        #expect(board.tasks(projectIdentifier: inboxIdentifier).map(\.title) == ["Inbox"])
        #expect(board.tasks(projectIdentifier: launchIdentifier).map(\.title) == ["Launch"])
    }

    @Test func resetDropsOneProjectsTasks() {
        var board = TaskBoard()
        board.merge(projectIdentifier: inboxIdentifier, tasks: [task(number: 1, title: "Inbox", updatedAt: newer)])
        board.merge(projectIdentifier: launchIdentifier, tasks: [task(number: 1, title: "Launch", updatedAt: older)])
        board.reset(projectIdentifier: inboxIdentifier)
        board.merge(projectIdentifier: inboxIdentifier, tasks: [task(number: 1, title: "Pulled again", updatedAt: older)])
        #expect(board.tasks(projectIdentifier: inboxIdentifier).map(\.title) == ["Pulled again"])
        #expect(board.tasks(projectIdentifier: launchIdentifier).map(\.title) == ["Launch"])
    }
}
