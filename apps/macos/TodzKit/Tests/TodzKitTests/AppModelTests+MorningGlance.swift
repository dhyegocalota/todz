import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let glanceRowLimit = 5
private let minutesPerHour = 60
private let lastMinuteOfTheDay = 23 * minutesPerHour + 59
private let firstMinuteOfTheDay = 1

extension AppModelTests {
    @MainActor private func glanceHarness(openCount: Int, dueDaysFromToday: Int = 0) async throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let dueDate = harness.model.today.adding(days: dueDaysFromToday)
        harness.service.tasksOfProject[inboxIdentifier] = (0..<openCount).map {
            MutableTask(number: $0 + 1, title: "Task \($0 + 1)", dueDate: dueDate, orderKey: "a\($0)").record
        }
        await harness.signedIn()
        return harness
    }

    @Test func theMorningGlanceContentIsNoneWhileTodayLoads() throws {
        let harness = try AppModelHarness()
        #expect(harness.model.morningGlanceContent == nil)
    }

    @Test func theMorningGlanceContentIsNoneWhileSignedOut() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        #expect(harness.model.phase == .signedOut(notice: nil))
        #expect(harness.model.morningGlanceContent == nil)
    }

    @Test func anEmptyTodayHasNoRowsAndNothingLeft() async throws {
        let harness = try await glanceHarness(openCount: 0)
        let content = try #require(harness.model.morningGlanceContent)
        #expect(content.openCount == 0)
        #expect(content.rows.isEmpty)
        #expect(content.restCount == 0)
    }

    @Test func oneOpenTaskIsOneRowThatIsNotOverdue() async throws {
        let harness = try await glanceHarness(openCount: 1)
        let content = try #require(harness.model.morningGlanceContent)
        #expect(content.openCount == 1)
        #expect(content.rows.map(\.title) == ["Task 1"])
        #expect(content.rows.map(\.isOverdue) == [false])
        #expect(content.restCount == 0)
    }

    @Test func fiveOpenTasksAreFiveRowsAndNoRest() async throws {
        let harness = try await glanceHarness(openCount: glanceRowLimit)
        let content = try #require(harness.model.morningGlanceContent)
        #expect(content.rows.count == glanceRowLimit)
        #expect(content.restCount == 0)
    }

    @Test func sevenOpenTasksAreTheFirstFiveInTodaysOrderAndTwoMore() async throws {
        let harness = try await glanceHarness(openCount: 7)
        let content = try #require(harness.model.morningGlanceContent)
        #expect(content.openCount == 7)
        #expect(content.rows.map(\.title) == (1...glanceRowLimit).map { "Task \($0)" })
        #expect(content.restCount == 2)
    }

    @Test func anOverdueTaskIsMarkedOverdue() async throws {
        let harness = try await glanceHarness(openCount: 1, dueDaysFromToday: -1)
        let content = try #require(harness.model.morningGlanceContent)
        #expect(content.rows.map(\.isOverdue) == [true])
    }

    @Test func aPendingTaskIsNeitherCountedNorListedAndMatchesTheHeadingCount() async throws {
        let harness = try await glanceHarness(openCount: 2)
        harness.service.suspend(.addTasks)
        await harness.model.addTask(title: "Call the bank", projectIdentifier: inboxIdentifier, dueDate: harness.model.today)
        await harness.service.held(.addTasks)
        #expect(harness.model.taskViews?.pendingTasks(for: .today).map(\.title) == ["Call the bank"])
        let content = try #require(harness.model.morningGlanceContent)
        #expect(content.openCount == 2)
        #expect(content.rows.map(\.title) == ["Task 1", "Task 2"])
        #expect(content.openCount == harness.model.todayHeadingCount)
        harness.service.resume(.addTasks)
        await harness.flushed()
    }

    @Test func theActiveWorkspaceIdentifierIsCarried() async throws {
        let harness = try await glanceHarness(openCount: 1)
        #expect(harness.model.morningGlanceContent?.workspaceIdentifier == "acme")
    }

    @Test func aTaskDueTodayIsNotOverdueAtTheEndOfTheDayAndOverdueTwoMinutesIntoTheNext() async throws {
        let harness = try await glanceHarness(openCount: 1)
        let dueDay = harness.model.today
        let timeZone = try #require(TimeZone(identifier: harnessTimeZoneIdentifier))
        harness.clock.now = DayCloseSchedule.instant(day: dueDay, minutesAfterMidnight: lastMinuteOfTheDay, timeZone: timeZone)
        #expect(harness.model.morningGlanceContent?.rows.map(\.isOverdue) == [false])
        harness.clock.now = DayCloseSchedule.instant(day: dueDay.adding(days: 1), minutesAfterMidnight: firstMinuteOfTheDay, timeZone: timeZone)
        #expect(harness.model.morningGlanceContent?.rows.map(\.isOverdue) == [true])
    }
}
