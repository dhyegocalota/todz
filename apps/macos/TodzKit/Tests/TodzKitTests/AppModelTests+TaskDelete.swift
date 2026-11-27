import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let deletedKey = TaskKey(projectIdentifier: inboxIdentifier, number: 2)
private let keptKey = TaskKey(projectIdentifier: inboxIdentifier, number: 1)

@MainActor private func signedInWithTwoTasks() async throws -> AppModelHarness {
    let harness = try AppModelHarness()
    harness.seedWorkspace(name: "acme")
    harness.seedTasks(projectIdentifier: inboxIdentifier, count: 2)
    harness.rememberWorkspace(identifier: "acme")
    await harness.signedIn()
    return harness
}

@MainActor private func shownNumbers(_ harness: AppModelHarness) -> [Int] {
    harness.model.board.tasks(projectIdentifier: inboxIdentifier).map(\.number)
}

extension AppModelTests {
    @Test func deletingATaskSendsOneDeleteAndDropsItFromTheBoardTheCacheAndTheSelection() async throws {
        let harness = try await signedInWithTwoTasks()
        harness.model.selectedTask = deletedKey
        await harness.model.delete(task: deletedKey)
        #expect(harness.service.calls == [.deleteTask(session: harness.session, projectIdentifier: inboxIdentifier, number: 2, title: "Task 2")])
        #expect(shownNumbers(harness) == [1])
        #expect(harness.store.projects[inboxIdentifier]?.tasks.map(\.number) == [1])
        #expect(harness.model.selectedTask == nil)
        #expect(harness.model.banner == nil)
    }

    @Test func deletingATaskKeepsTheSelectionOfAnotherTask() async throws {
        let harness = try await signedInWithTwoTasks()
        harness.model.selectedTask = keptKey
        await harness.model.delete(task: deletedKey)
        #expect(harness.model.selectedTask == keptKey)
    }

    @Test func aTaskTheServerNoLongerHasLeavesTheBoardToo() async throws {
        let harness = try await signedInWithTwoTasks()
        harness.service.failures[.deleteTask] = .taskNotFound(number: 2)
        await harness.model.delete(task: deletedKey)
        #expect(shownNumbers(harness) == [1])
        #expect(harness.model.banner == nil)
    }

    @Test func anOfflineDeleteRaisesTheNetworkBannerAndKeepsTheTask() async throws {
        let harness = try await signedInWithTwoTasks()
        harness.service.failures[.deleteTask] = .unreachable
        await harness.model.delete(task: deletedKey)
        #expect(shownNumbers(harness) == [1, 2])
        #expect(harness.model.banner == .network)
    }

    @Test func aTaskAnAgentRenamedSinceTheAppShowedItIsKeptWithAClearBanner() async throws {
        let harness = try await signedInWithTwoTasks()
        harness.service.tasksOfProject[inboxIdentifier]?[1] = MutableTask(number: 2, title: "Renamed by an agent").record
        await harness.model.delete(task: deletedKey)
        #expect(shownNumbers(harness) == [1, 2])
        #expect(harness.model.banner == .taskChangedBeforeDelete)
    }

    @Test func aDeleteInAProjectThatIsGoneReloadsAndSaysTheProjectIsGone() async throws {
        let harness = try await signedInWithTwoTasks()
        harness.service.failures[.deleteTask] = .notFound
        await harness.model.delete(task: deletedKey)
        #expect(harness.model.banner == .projectGone)
    }

    @Test func aDeletedTaskTakesItsWaitingChangesAlongAndLeavesTheOthers() async throws {
        let harness = try await signedInWithTwoTasks()
        harness.service.failures[.updateTask] = .unreachable
        await harness.model.updateTitle(task: deletedKey, title: "Renamed here")
        await harness.pause.started()
        await harness.model.updateTitle(task: keptKey, title: "Kept here")
        await harness.model.delete(task: deletedKey)
        #expect(harness.model.outbox.pendingChanges.compactMap(\.taskKey) == [keptKey])
        #expect(harness.service.calls.contains(.deleteTask(session: harness.session, projectIdentifier: inboxIdentifier, number: 2, title: "Task 2")))
    }

    @Test func deletingATaskOfALockedWorkspaceIsRefusedAndSendsNothing() async throws {
        let harness = try AppModelHarness(isWorkspaceLockOn: true)
        let acme = harness.seedWorkspace(name: "acme")
        let secret = harness.seedWorkspace(name: "secret")
        harness.seedTasks(projectIdentifier: "secret-inbox", count: 1)
        harness.store.owner = OwnerCache(ownerIdentifier: harness.ownerIdentifier, workspaces: [acme, secret], activeWorkspaceIdentifier: acme.identifier)
        await harness.signedIn()
        await harness.model.delete(task: TaskKey(projectIdentifier: "secret-inbox", number: 1))
        #expect(harness.model.banner == .workspaceGone)
        #expect(!harness.service.routes().contains(.deleteTask))
    }
}
