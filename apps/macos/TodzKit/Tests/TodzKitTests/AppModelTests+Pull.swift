import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let launchIdentifier = "acme-launch"

extension AppModelTests {
    @MainActor private func pullHarness() async throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        harness.seedWorkspace(name: "side")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 2)
        await harness.signedIn()
        harness.store.calls = []
        return harness
    }

    @Test func threeTriggersDuringOnePullMakeTwoPullsTheSecondFromTheFirstsCursor() async throws {
        let harness = try await pullHarness()
        harness.service.suspend(.readChanges)
        let first = Task { await harness.model.pullProject(identifier: inboxIdentifier) }
        await harness.service.held(.readChanges)
        let triggers = (1...3).compactMap { _ in harness.model.requestPull(projectIdentifier: inboxIdentifier) }
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 3)
        harness.service.unsuspend(.readChanges)
        harness.service.resume(.readChanges)
        _ = await first.value
        #expect(triggers.count == 3)
        let inboxPulls = harness.service.calls.filter { $0.projectIdentifier == inboxIdentifier }
        #expect(
            inboxPulls == [
                .readChanges(session: harness.session, projectIdentifier: inboxIdentifier, cursor: 2),
                .readChanges(session: harness.session, projectIdentifier: inboxIdentifier, cursor: 3),
            ]
        )
        #expect(harness.store.projects[inboxIdentifier]?.cursor == 3)
    }

    @Test func aPullAfterCursorAheadReplacesTheProjectsTasksFromZero() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 2)
        harness.cache([acme], active: acme)
        harness.cacheTasks(projectIdentifier: inboxIdentifier, count: 3, cursor: 9)
        harness.service.changeScripts[inboxIdentifier] = [.failure(.cursorAhead)]
        await harness.launchedFromCache()
        #expect(harness.model.taskViews?.inbox.map(\.task.title) == ["Task 1", "Task 2"])
        #expect(harness.store.projects[inboxIdentifier]?.cursor == 2)
        #expect(harness.store.projects[inboxIdentifier]?.tasks.map(\.title) == ["Task 1", "Task 2"])
    }

    @Test func aPullAnsweredAfterASwitchWritesNothing() async throws {
        let harness = try await pullHarness()
        harness.service.suspend(.readChanges)
        let refreshing = Task { await harness.model.refresh() }
        await harness.service.held(.readChanges, count: 2)
        harness.service.unsuspend(.readChanges)
        await harness.model.switchWorkspace(identifier: "side")
        harness.store.calls = []
        harness.service.resume(.readChanges)
        harness.service.resume(.readChanges)
        await refreshing.value
        #expect(harness.store.routes().contains(.writeProject) == false)
        #expect(harness.model.board.tasks(projectIdentifier: inboxIdentifier) == [])
    }

    @Test func isRefreshingHoldsOnlyWhileARefreshTheOwnerStartedRuns() async throws {
        let harness = try await pullHarness()
        harness.service.suspend(.readChanges)
        let refreshing = Task { await harness.model.refresh() }
        await harness.service.held(.readChanges, count: 2)
        #expect(harness.model.isRefreshing)
        harness.service.resume(.readChanges)
        harness.service.resume(.readChanges)
        await refreshing.value
        #expect(harness.model.isRefreshing == false)
        let pulling = Task { await harness.model.pullProject(identifier: inboxIdentifier) }
        await harness.service.held(.readChanges)
        #expect(harness.model.isRefreshing == false)
        harness.service.resume(.readChanges)
        _ = await pulling.value
    }

    @Test func aFailedPullOfProjectsWithRowsRaisesNoBanner() async throws {
        let harness = try await pullHarness()
        harness.service.failures[.readChanges] = .unreachable
        await harness.model.refresh()
        #expect(harness.model.banner == nil)
        #expect(harness.model.projectLoads == [inboxIdentifier: .loaded, launchIdentifier: .loaded])
        harness.service.failures[.readChanges] = .unexpected(status: 500)
        await harness.model.refresh()
        #expect(harness.model.banner == nil)
    }

    @Test func aFailedPullOfAProjectWithNothingCachedKeepsTheShellsBanner() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        harness.service.projectFailures[launchIdentifier] = .unreachable
        await harness.signedIn()
        #expect(harness.model.banner == .someProjectsFailed)
        harness.model.dismissBanner()
        await harness.model.refresh()
        #expect(harness.model.banner == .someProjectsFailed)
        #expect(harness.service.calls.filter { $0.projectIdentifier == launchIdentifier }.map(\.cursor) == [0])
    }

    @Test func theStatusIsOfflineWithTheWaitingCountWhileSendsCannotReachTheServer() async throws {
        let harness = try await pullHarness()
        #expect(harness.model.syncStatus == .online)
        harness.service.failures[.completeTasks] = .unreachable
        await harness.model.complete(task: TaskKey(projectIdentifier: inboxIdentifier, number: 1))
        await harness.pause.started()
        #expect(harness.model.syncStatus == .offline(waiting: 1))
        await harness.model.updateTitle(task: TaskKey(projectIdentifier: inboxIdentifier, number: 2), title: "B")
        await harness.pause.started(count: 2)
        #expect(harness.model.syncStatus == .offline(waiting: 2))
        harness.service.failures = [:]
        harness.pause.release()
        await harness.flushed()
        #expect(harness.model.syncStatus == .online)
    }

    @Test func aSendThatFailsTransientlyIsOffline() async throws {
        let harness = try await pullHarness()
        harness.service.failures[.completeTasks] = .unexpected(status: 503)
        await harness.model.complete(task: TaskKey(projectIdentifier: inboxIdentifier, number: 1))
        await harness.pause.started()
        #expect(harness.model.syncStatus == .offline(waiting: 1))
    }

    @Test(arguments: [OwnerAPIError.unreachable, .unexpected(status: 500)])
    func aPullThatFailsIsOfflineAndTheNextAnswerIsOnline(failure: OwnerAPIError) async throws {
        let harness = try await pullHarness()
        harness.service.failures[.readChanges] = failure
        await harness.model.refresh()
        #expect(harness.model.syncStatus == .offline(waiting: 0))
        harness.service.failures = [:]
        await harness.model.refresh()
        #expect(harness.model.syncStatus == .online)
    }

    @Test func aCachedLaunchWithTheServerDownIsOffline() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        harness.cache([acme], active: acme)
        harness.cacheTasks(projectIdentifier: inboxIdentifier, count: 1, cursor: 1)
        harness.service.failures[.updateOwner] = .unreachable
        harness.service.failures[.listWorkspaces] = .unreachable
        await harness.launchedFromCache()
        #expect(harness.model.syncStatus == .offline(waiting: 0))
        #expect(harness.model.banner == nil)
    }
}
