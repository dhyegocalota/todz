import Foundation
import Testing
@testable import TodzKit

private let ownerEmail = "maria@example.com"
private let cachedTitle = "Theirs"
private let otherOwner = "someone-else"
private let otherServer = "https://other.example.com"

extension AppModelTests {
    @MainActor private func isOnlyLine(_ harness: AppModelHarness, for erase: LaunchErase) -> Bool {
        let lines = harness.breadcrumbLines
        return lines.count == 1 && lines[0].contains(erase.path) && lines[0].hasSuffix(erase.reason)
    }

    @Test func aLaunchThatErasesNothingWritesNoLine() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        #expect(harness.breadcrumbLines.isEmpty)
    }

    @Test func anUnreadableOwnerFileAtLaunchWritesOneLine() async throws {
        let harness = try AppModelHarness()
        harness.store.failures[.readOwner] = .unreadable
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(isOnlyLine(harness, for: .ownerCacheUnreadable))
    }

    @Test func anOwnerOtherThanTheCachesWritesOneLineThatNamesNeitherOwnerNorTask() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: "acme-inbox", count: 1)
        harness.cache([acme], active: acme, ownerIdentifier: otherOwner)
        harness.cacheTasks(projectIdentifier: "acme-inbox", count: 1, cursor: 1)
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(isOnlyLine(harness, for: .ownerMismatchAtLaunch))
        #expect(harness.breadcrumbLines.allSatisfy { !$0.contains(otherOwner) && !$0.contains(cachedTitle) && !$0.contains("Cached") })
    }

    @Test func aSignInOfAnotherOwnerThanTheCachesWritesOneLine() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        harness.cache([acme], active: acme, ownerIdentifier: otherOwner)
        await harness.model.signIn(identity: "maria")
        #expect(isOnlyLine(harness, for: .ownerMismatchAtSignIn))
    }

    @Test func aSessionBoundToAnotherServerWritesOneLineWithNoAddressOrEmail() async throws {
        let harness = try AppModelHarness(isLocalDataKept: true, sessionOrigin: otherServer)
        #expect(isOnlyLine(harness, for: .sessionOfAnotherServer))
        #expect(harness.breadcrumbLines.allSatisfy { !$0.contains(otherServer) && !$0.contains(ownerEmail) })
    }

    @Test func anUnreadableStoredServerWritesOneLine() async throws {
        let harness = try AppModelHarness(storedServer: "not a url", isLocalDataKept: true)
        #expect(isOnlyLine(harness, for: .unreadableServer))
    }

    @Test func aLaunchWithNoCacheAtAllWritesNoLineForTheEraseOfNothing() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: "acme-inbox", count: 1)
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(harness.breadcrumbLines.isEmpty)
    }
}
