import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let otherServerText = "http://localhost:8791"

@MainActor @Suite struct ModelCacheWriterTests {
    private func signedInHarness(drains: HeldCacheDrains) async throws -> AppModelHarness {
        let harness = try AppModelHarness(cacheScheduler: drains.scheduler)
        harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 2)
        await harness.signedIn()
        return harness
    }

    @Test func aPullQueuesItsWriteAndTheDrainWritesIt() async throws {
        let drains = HeldCacheDrains()
        let harness = try await signedInHarness(drains: drains)
        #expect(harness.store.projects[inboxIdentifier] == nil)
        await drains.runOffTheMainThread()
        #expect(harness.store.projects[inboxIdentifier]?.cursor == 2)
    }

    @Test func aSignOutDropsTheQueuedWritesAndNothingReachesTheStoreAfterTheWipe() async throws {
        let drains = HeldCacheDrains()
        let harness = try await signedInHarness(drains: drains)
        await harness.model.signOut()
        await drains.runOffTheMainThread()
        #expect(harness.store.routes().contains(.writeProject) == false)
        #expect(harness.store.projects == [:])
    }

    @Test func aServerSwitchDropsTheQueuedWritesSoNothingOfTheOldServerReachesTheNewOnesStore() async throws {
        let drains = HeldCacheDrains()
        let harness = try await signedInHarness(drains: drains)
        let result = await harness.model.switchServer(to: try ServerAddress.checked(text: otherServerText).get())
        await drains.runOffTheMainThread()
        #expect(result == .switched)
        #expect(harness.store.routes().contains(.writeProject) == false)
        #expect(harness.store.projects == [:])
    }

    @Test func flushingWritesWhatIsQueuedBeforeTheAppEnds() async throws {
        let drains = HeldCacheDrains()
        let harness = try await signedInHarness(drains: drains)
        #expect(harness.store.projects.isEmpty)
        harness.model.flushCache()
        #expect(harness.store.projects[inboxIdentifier]?.cursor == 2)
    }

    @Test func loadingTheCacheOfAProjectFirstWritesWhatIsQueuedForIt() async throws {
        let drains = HeldCacheDrains()
        let harness = try await signedInHarness(drains: drains)
        #expect(harness.store.projects[inboxIdentifier] == nil)
        harness.model.board = TaskBoard()
        harness.model.loadCachedProjects(of: harness.model.workspaces[0])
        #expect(harness.model.board.tasks(projectIdentifier: inboxIdentifier).count == 2)
    }

    @Test func aWriteThatFailsInTheBackgroundRaisesTheCacheBannerOnTheMainActor() async throws {
        let drains = HeldCacheDrains()
        let harness = try await signedInHarness(drains: drains)
        harness.store.failures[.writeProject] = .unwritable
        await drains.runOffTheMainThread()
        #expect(harness.model.banner == .cacheNotSaved)
    }
}
