import Foundation
import Testing
@testable import TodzKit

private let inbox = Project(identifier: "inbox", name: "Inbox", isInbox: true, createdAt: fixedInstant)
private let today = CalendarDate(year: 2026, month: 11, day: 24)
private let orderKeys = ["a0", "a1", "a2"]
private let titles = ["A", "B", "C"]

private func key(_ number: Int) -> TaskKey {
    TaskKey(projectIdentifier: inbox.identifier, number: number)
}

private func views(done doneNumbers: Set<Int>, dueDate: CalendarDate? = nil) throws -> TaskViews {
    let timeZone = try #require(TimeZone(identifier: "America/Sao_Paulo"))
    let tasks = titles.indices.map { index in
        let number = index + 1
        let isDone = doneNumbers.contains(number)
        return MutableTask(
            number: number,
            title: titles[index],
            dueDate: dueDate,
            state: isDone ? .done : .open,
            orderKey: orderKeys[index],
            completedAt: isDone ? fixedInstant : nil
        ).record
    }
    var board = TaskBoard()
    board.merge(projectIdentifier: inbox.identifier, tasks: tasks)
    return TaskViews(projects: [inbox], board: board, day: today, timeZone: timeZone)
}

private func labels(_ tasks: [BoardTask]) -> [String] {
    tasks.map { $0.task.state == .done ? "\($0.task.title) done" : $0.task.title }
}

@Suite struct CompletionLingersTests {
    @Test func aTaskCheckedInTheInboxStaysAtItsPlaceAsDone() throws {
        let lingers = CompletionLingers().toggling(task: key(2), in: .inbox, views: try views(done: []))
        let checked = try views(done: [2])
        #expect(lingers.contains(task: key(2)))
        #expect(labels(lingers.placed(into: checked.inbox, item: .inbox, views: checked)) == ["A", "B done", "C"])
    }

    @Test func tasksCheckedOneAfterAnotherKeepTheirPlaces() throws {
        let first = CompletionLingers().toggling(task: key(1), in: .inbox, views: try views(done: []))
        let both = first.toggling(task: key(2), in: .inbox, views: try views(done: [1]))
        let checked = try views(done: [1, 2])
        #expect(labels(both.placed(into: checked.inbox, item: .inbox, views: checked)) == ["A done", "B done", "C"])
    }

    @Test func aLingerShowsOnlyInTheListWhereItStarted() throws {
        let lingers = CompletionLingers().toggling(task: key(2), in: .inbox, views: try views(done: []))
        let checked = try views(done: [2])
        let project = SidebarItem.project(identifier: inbox.identifier)
        #expect(labels(lingers.placed(into: checked.inbox, item: project, views: checked)) == ["A", "C"])
        #expect(lingers.lingeringKeys(item: .today, views: checked) == [])
    }

    @Test func checkingTheLingeringTaskAgainEndsItsLinger() throws {
        let lingers = CompletionLingers().toggling(task: key(2), in: .inbox, views: try views(done: []))
        let reopened = lingers.toggling(task: key(2), in: .inbox, views: try views(done: [2]))
        #expect(!reopened.contains(task: key(2)))
        #expect(reopened == CompletionLingers())
    }

    @Test func anEndedLingerLetsTheTaskLeave() throws {
        let lingers = CompletionLingers().toggling(task: key(2), in: .inbox, views: try views(done: []))
        let checked = try views(done: [2])
        let ended = lingers.ending(task: key(2))
        #expect(!ended.contains(task: key(2)))
        #expect(labels(ended.placed(into: checked.inbox, item: .inbox, views: checked)) == ["A", "C"])
    }

    @Test func aLingeringTaskReopenedElsewhereShowsOnce() throws {
        let opened = try views(done: [])
        let lingers = CompletionLingers().toggling(task: key(2), in: .inbox, views: opened)
        #expect(labels(lingers.placed(into: opened.inbox, item: .inbox, views: opened)) == ["A", "B", "C"])
        #expect(lingers.lingeringKeys(item: .inbox, views: opened) == [])
    }

    @Test func aTaskCheckedInTodayStaysInTheOpenListAndIsNamedForDoneToday() throws {
        let lingers = CompletionLingers().toggling(task: key(1), in: .today, views: try views(done: [], dueDate: today))
        let checked = try views(done: [1], dueDate: today)
        #expect(labels(lingers.placed(into: checked.today.open, item: .today, views: checked)) == ["A done", "B", "C"])
        #expect(lingers.lingeringKeys(item: .today, views: checked) == [key(1)])
    }

    @Test(arguments: [SidebarItem.upcoming, .done])
    func noLingerStartsInAListWithoutAnOpenOrder(item: SidebarItem) throws {
        let lingers = CompletionLingers().toggling(task: key(2), in: item, views: try views(done: [], dueDate: today.adding(days: 1)))
        #expect(!lingers.contains(task: key(2)))
    }

    @Test func aShorterListTakesTheLingeringTaskLast() throws {
        let lingers = CompletionLingers().toggling(task: key(3), in: .inbox, views: try views(done: []))
        let shorter = try views(done: [1, 3])
        #expect(labels(lingers.placed(into: shorter.inbox, item: .inbox, views: shorter)) == ["B", "C done"])
    }
}
