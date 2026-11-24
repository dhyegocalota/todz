import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let sideInboxIdentifier = "side-inbox"
private let today = CalendarDate(year: 2026, month: 11, day: 24)
private let tomorrow = CalendarDate(year: 2026, month: 11, day: 25)
private let secondsPerDay: TimeInterval = 86_400

private func dueToday(_ count: Int, prefix: String = "Task") -> [TaskRecord] {
    (1...count).map { MutableTask(number: $0, title: "\(prefix) \($0)", dueDate: today).record }
}

extension AppModelTests {
    @MainActor private func widgetHarness() throws -> AppModelHarness {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        let tasks = dueToday(2)
        harness.service.tasksOfProject[inboxIdentifier] = tasks
        harness.cache([acme], active: acme)
        harness.store.projects[inboxIdentifier] = ProjectCache(projectIdentifier: inboxIdentifier, cursor: tasks.count, tasks: tasks)
        return harness
    }

    @MainActor private func launchedWidgetHarness() async throws -> AppModelHarness {
        let harness = try widgetHarness()
        await harness.launchedFromCache()
        await harness.published()
        harness.widgets.calls = []
        return harness
    }

    @Test func aCachedLaunchWritesTheSnapshotOnceAndReloadsOnce() async throws {
        let harness = try widgetHarness()
        harness.vault.secret = harness.session
        await harness.model.launch()
        await harness.published()
        #expect(harness.widgets.routes() == [.writeSnapshot, .reload])
        #expect(harness.widgets.snapshot?.workspaceName == "acme")
        #expect(harness.widgets.snapshot?.day == today)
        #expect(harness.widgets.snapshot?.open.map(\.title) == ["Task 1", "Task 2"])
    }

    @Test func aLaunchStillLoadingLeavesTheWidgetFilesAlone() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.service.suspend(.updateOwner)
        harness.vault.secret = harness.session
        let launching = Task { await harness.model.launch() }
        await harness.service.held(.updateOwner)
        await harness.published()
        #expect(harness.model.phase == .loading)
        #expect(harness.widgets.calls == [])
        harness.service.resume(.updateOwner)
        await launching.value
    }

    @Test func aSignedOutLaunchErasesTheSnapshotOnceAndReloads() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        await harness.published()
        #expect(harness.widgets.routes() == [.eraseSnapshot, .reload])
        harness.service.failures[.signIn] = .identityRejected
        await harness.model.signIn(identity: "dhyego")
        #expect(harness.model.signInError != nil)
        await harness.published()
        #expect(harness.widgets.routes() == [.eraseSnapshot, .reload])
    }

    @Test func namingTheFirstWorkspaceShowsNoSnapshot() async throws {
        let harness = try AppModelHarness()
        await harness.signedIn()
        await harness.published()
        #expect(harness.model.phase == .naming)
        #expect(harness.widgets.routes() == [.eraseSnapshot, .reload])
    }

    @Test func anAddWritesASecondSnapshotWithThePendingTask() async throws {
        let harness = try await launchedWidgetHarness()
        harness.service.suspend(.addTasks)
        await harness.model.addTask(title: "Draft", projectIdentifier: inboxIdentifier, dueDate: today)
        await harness.published()
        #expect(harness.widgets.routes() == [.writeSnapshot, .reload])
        #expect(harness.widgets.snapshot?.pending.map(\.title) == ["Draft"])
        harness.service.unsuspend(.addTasks)
        harness.service.resume(.addTasks)
        await harness.flushed()
    }

    @Test func aPullThatChangesNothingWritesNothing() async throws {
        let harness = try await launchedWidgetHarness()
        await harness.model.refresh()
        await harness.published()
        #expect(harness.service.routes().contains(.readChanges))
        #expect(harness.widgets.calls == [])
    }

    @Test func aWorkspaceSwitchWritesTheNewWorkspacesToday() async throws {
        let harness = try widgetHarness()
        let side = harness.seedWorkspace(name: "side")
        harness.service.tasksOfProject[sideInboxIdentifier] = dueToday(1, prefix: "Side")
        await harness.launchedFromCache()
        await harness.published()
        await harness.model.switchWorkspace(identifier: side.identifier)
        await harness.published()
        #expect(harness.widgets.snapshot?.workspaceName == "side")
        #expect(harness.widgets.snapshot?.open.map(\.title) == ["Side 1"])
        #expect(harness.widgets.routes().last == .reload)
    }

    @Test func aSignOutErasesTheSnapshotAndReloads() async throws {
        let harness = try await launchedWidgetHarness()
        await harness.model.signOut()
        await harness.published()
        #expect(harness.widgets.snapshot == nil)
        #expect(harness.widgets.routes().suffix(2) == [.eraseSnapshot, .reload])
    }

    @Test func aDayChangeWritesTheNewDayOnce() async throws {
        let harness = try await launchedWidgetHarness()
        harness.clock.now = fixedInstant.addingTimeInterval(secondsPerDay)
        harness.model.dayChanged()
        await harness.published()
        #expect(harness.widgets.routes() == [.writeSnapshot, .reload])
        #expect(harness.widgets.snapshot?.day == tomorrow)
        #expect(harness.widgets.snapshot?.open.map(\.isOverdue) == [true, true])
    }
}
