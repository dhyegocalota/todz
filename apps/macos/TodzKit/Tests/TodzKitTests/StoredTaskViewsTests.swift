import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let secondsPerDay: TimeInterval = 86_400
private let dayAfterTomorrowOffset = 2
private let firstTask = TaskKey(projectIdentifier: inboxIdentifier, number: 1)

@MainActor @Suite struct StoredTaskViewsTests {
    private func harnessWithOneTask(dueInDays offset: Int?) async throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let dueDate = offset.map { harness.model.today.adding(days: $0) }
        harness.service.tasksOfProject[inboxIdentifier] = [MutableTask(number: 1, title: "A", dueDate: dueDate).record]
        await harness.signedIn()
        return harness
    }

    @Test func theSameViewsAnswerUntilSomethingChanges() async throws {
        let harness = try await harnessWithOneTask(dueInDays: nil)
        let builds = harness.model.taskViewsBuildCount
        _ = harness.model.taskViews
        _ = harness.model.taskViews
        #expect(harness.model.taskViewsBuildCount == builds)
    }

    @Test func aChangeOfTheBoardBuildsTheViewsAgain() async throws {
        let harness = try await harnessWithOneTask(dueInDays: nil)
        #expect(harness.model.taskViews?.inbox.map(\.task.title) == ["A"])
        await harness.model.updateTitle(task: firstTask, title: "B")
        await harness.flushed()
        #expect(harness.model.taskViews?.inbox.map(\.task.title) == ["B"])
    }

    @Test func aChangeOfTheOutboxBuildsTheViewsAgain() async throws {
        let harness = try await harnessWithOneTask(dueInDays: nil)
        harness.service.suspend(.updateTask)
        await harness.model.updateTitle(task: firstTask, title: "Waiting")
        #expect(harness.model.taskViews?.inbox.map(\.task.title) == ["Waiting"])
        harness.service.unsuspend(.updateTask)
        harness.service.resume(.updateTask)
        await harness.flushed()
    }

    @Test func aTaskDueTomorrowMovesFromUpcomingToTodayWhenTheClockPassesMidnight() async throws {
        let harness = try await harnessWithOneTask(dueInDays: 1)
        #expect(harness.model.taskViews?.upcoming.map(\.task.number) == [1])
        #expect(harness.model.taskViews?.today.open.map(\.task.number) == [])
        harness.clock.now = harness.clock.now.addingTimeInterval(secondsPerDay)
        #expect(harness.model.taskViews?.upcoming.map(\.task.number) == [])
        #expect(harness.model.taskViews?.today.open.map(\.task.number) == [1])
    }

    @Test func aTaskCompletedTodayLeavesDoneTodayWhenTheClockPassesMidnight() async throws {
        let harness = try await harnessWithOneTask(dueInDays: 0)
        await harness.model.complete(task: firstTask)
        await harness.flushed()
        #expect(harness.model.taskViews?.today.doneToday.map(\.task.number) == [1])
        harness.clock.now = harness.clock.now.addingTimeInterval(secondsPerDay * Double(dayAfterTomorrowOffset))
        #expect(harness.model.taskViews?.today.doneToday.map(\.task.number) == [])
    }

    @Test func aCompletionLingersWhereItWasAndLeavesWhenTheLingerEnds() async throws {
        let harness = try await harnessWithOneTask(dueInDays: nil)
        let before = try #require(harness.model.taskViews)
        let lingers = CompletionLingers().toggling(task: firstTask, in: .inbox, views: before)
        await harness.model.complete(task: firstTask)
        await harness.flushed()
        let after = try #require(harness.model.taskViews)
        let shown = lingers.placed(into: after.inbox, item: .inbox, views: after)
        #expect(shown.map(\.task.number) == [1])
        #expect(shown.map(\.task.state) == [.done])
        let ended = lingers.ending(task: firstTask)
        #expect(ended.placed(into: after.inbox, item: .inbox, views: after) == [])
    }
}
