import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let newerMinimum = "0.3.0"
private let otherText = "http://localhost:8791"

private func health(server: String?, minimumApp: String?) -> Result<ServerHealthAnswer, OwnerAPIError> {
    .success(.todz(origin: harnessDefaultServer, versions: ServerVersions(server: server, minimumApp: minimumApp)))
}

extension AppModelTests {
    @MainActor private func signedInHarness() async throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 2)
        await harness.signedIn()
        await harness.versionsRead()
        return harness
    }

    @Test func launchWithACompatibleHealthAnswerIsCompatible() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        await harness.versionsRead()
        #expect(harness.model.compatibility == .compatible(app: OwnerFixtures.appVersion, server: compatibleStamp))
    }

    @Test func aRefreshThatAnswersALaterMinimumNeedsAnUpdate() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        harness.service.healthAnswer = health(server: compatibleStamp, minimumApp: newerMinimum)
        harness.model.refreshCompatibility()
        await harness.versionsRead()
        #expect(harness.model.compatibility == .updateNeeded(app: OwnerFixtures.appVersion, server: compatibleStamp, minimum: newerMinimum))
    }

    @Test func aServerSwitchRecomputesFromTheNewServer() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        harness.servers.healthAnswerOfNext = health(server: nil, minimumApp: nil)
        await harness.model.switchServer(to: try ServerAddress.checked(text: otherText).get())
        await harness.versionsRead()
        #expect(harness.model.compatibility == .serverBehind(app: OwnerFixtures.appVersion, server: nil))
        harness.servers.healthAnswerOfNext = FakeOwnerService.compatibleHealth
        await harness.model.switchServer(to: harness.defaultURL)
        await harness.versionsRead()
        #expect(harness.model.compatibility == .compatible(app: OwnerFixtures.appVersion, server: compatibleStamp))
    }

    @Test func aServerThatDoesNotAnswerLeavesTheAppAlone() async throws {
        let harness = try AppModelHarness()
        harness.service.healthAnswer = .failure(.unreachable)
        await harness.model.launch()
        await harness.versionsRead()
        #expect(harness.model.compatibility == .serverUnknown(app: OwnerFixtures.appVersion))
    }

    @Test func anOwnerCallRefusedAsTooOldNeedsAnUpdateAtOnce() async throws {
        let harness = try await signedInHarness()
        harness.service.failures[.addTasks] = .appTooOld(minimum: newerMinimum)
        await harness.model.addTask(title: "Call the bank", projectIdentifier: inboxIdentifier, dueDate: nil)
        await harness.flushed()
        #expect(harness.model.compatibility == .updateNeeded(app: OwnerFixtures.appVersion, server: compatibleStamp, minimum: newerMinimum))
        #expect(harness.model.banner == .updateNeeded)
    }

    @Test func aQueuedAddRefusedAsTooOldStaysAndWaitsForTheUpdatedApp() async throws {
        let harness = try await signedInHarness()
        harness.service.failures[.addTasks] = .appTooOld(minimum: newerMinimum)
        await harness.model.addTask(title: "Call the bank", projectIdentifier: inboxIdentifier, dueDate: nil)
        await harness.flushed()
        #expect(harness.model.waitingChangeCount == 1)
        #expect(harness.model.banner == .updateNeeded)
        await harness.model.addTask(title: "Pay the rent", projectIdentifier: inboxIdentifier, dueDate: nil)
        await harness.flushed()
        #expect(harness.model.waitingChangeCount == 2)
        #expect(harness.service.routes().filter { $0 == .addTasks }.count == 1)
        harness.service.failures[.addTasks] = nil
        harness.service.healthAnswer = FakeOwnerService.compatibleHealth
        harness.model.refreshCompatibility()
        await harness.versionsRead()
        await harness.flushed()
        #expect(harness.model.compatibility == .compatible(app: OwnerFixtures.appVersion, server: compatibleStamp))
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.model.banner == nil)
        #expect(harness.service.tasksOfProject[inboxIdentifier]?.count == 4)
    }

    @MainActor private func probedCompatibleAndFlushed(_ harness: AppModelHarness) async {
        harness.service.healthAnswer = FakeOwnerService.compatibleHealth
        harness.model.refreshCompatibility()
        await harness.versionsRead()
        await harness.flushed()
    }

    @Test func threeConsecutiveRefusalsKeepEveryQueuedChangeUncountedAndUnannounced() async throws {
        let harness = try await signedInHarness()
        harness.service.failures[.addTasks] = .appTooOld(minimum: nil)
        await harness.model.addTask(title: "Call the bank", projectIdentifier: inboxIdentifier, dueDate: nil)
        await harness.model.addTask(title: "Pay the rent", projectIdentifier: inboxIdentifier, dueDate: nil)
        await harness.flushed()
        let queued = harness.model.outbox
        await probedCompatibleAndFlushed(harness)
        await probedCompatibleAndFlushed(harness)
        #expect(harness.service.routes().filter { $0 == .addTasks }.count == 3)
        #expect(harness.model.outbox == queued)
        #expect(harness.model.waitingChangeCount == 2)
        #expect(harness.model.banner == .updateNeeded)
        #expect(harness.model.compatibility == .updateNeeded(app: OwnerFixtures.appVersion, server: compatibleStamp, minimum: nil))
    }

    @Test func afterTheAnswerIsNoLongerARefusalTheQueueFlushesInOrder() async throws {
        let harness = try await signedInHarness()
        harness.service.failures[.addTasks] = .appTooOld(minimum: nil)
        await harness.model.addTask(title: "Call the bank", projectIdentifier: inboxIdentifier, dueDate: nil)
        await harness.model.addTask(title: "Pay the rent", projectIdentifier: inboxIdentifier, dueDate: nil)
        await harness.flushed()
        harness.service.failures[.addTasks] = nil
        await probedCompatibleAndFlushed(harness)
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.model.banner == nil)
        #expect(harness.service.tasksOfProject[inboxIdentifier]?.map(\.title) == ["Task 1", "Task 2", "Call the bank", "Pay the rent"])
    }

    @Test func aSignInRefusedAsTooOldSaysSoAndNeedsAnUpdate() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        await harness.versionsRead()
        harness.service.failures[.signIn] = .appTooOld(minimum: newerMinimum)
        await harness.model.signIn(identity: "dhyego")
        #expect(harness.model.signInError == .appTooOld)
        #expect(harness.model.compatibility == .updateNeeded(app: OwnerFixtures.appVersion, server: compatibleStamp, minimum: newerMinimum))
    }
}
