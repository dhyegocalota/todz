import Foundation
import Testing
@testable import TodzKit

private let existingKey = OwnerFixtures.projectKey(identifier: "owner-key-existing")

@MainActor private func ownerKeyHarness() async throws -> AppModelHarness {
    let harness = try AppModelHarness()
    harness.seedWorkspace(name: "acme")
    harness.service.ownerKeys = [existingKey]
    await harness.signedIn()
    return harness
}

extension AppModelTests {
    @Test func loadingTheOwnerKeysListsThem() async throws {
        let harness = try await ownerKeyHarness()
        await harness.model.loadOwnerKeys()
        #expect(harness.model.ownerKeys == .loaded([existingKey]))
        #expect(harness.service.calls == [.listOwnerKeys(session: harness.session)])
    }

    @Test func aFailedFirstLoadOfTheOwnerKeysIsShownAsFailed() async throws {
        let harness = try await ownerKeyHarness()
        harness.service.failures[.listOwnerKeys] = .unreachable
        await harness.model.loadOwnerKeys()
        #expect(harness.model.ownerKeys == .failed(.unreachable))
    }

    @Test func aFailedReloadKeepsTheShownOwnerKeys() async throws {
        let harness = try await ownerKeyHarness()
        await harness.model.loadOwnerKeys()
        harness.service.failures[.listOwnerKeys] = .unreachable
        await harness.model.loadOwnerKeys()
        #expect(harness.model.ownerKeys == .loaded([existingKey]))
    }

    @Test func creatingAnOwnerKeyShowsItsSecretOnceAndListsIt() async throws {
        let harness = try await ownerKeyHarness()
        await harness.model.loadOwnerKeys()
        await harness.model.issueOwnerKey()
        let issued = try #require(harness.model.issuedOwnerKey)
        #expect(issued.secret.hasPrefix("todz-owner_"))
        #expect(harness.model.ownerKeys == .loaded([existingKey, issued.key]))
        #expect(harness.model.ownerKeyFailure == nil)
        #expect(harness.model.isChangingOwnerKeys == false)
        harness.model.hideOwnerKey()
        #expect(harness.model.issuedOwnerKey == nil)
    }

    @Test func creatingPastTheLimitSaysSoAndShowsNoSecret() async throws {
        let harness = try await ownerKeyHarness()
        harness.service.failures[.issueOwnerKey] = .limitReached
        await harness.model.issueOwnerKey()
        #expect(harness.model.ownerKeyFailure == .limitReached)
        #expect(harness.model.issuedOwnerKey == nil)
        #expect(harness.model.ownerKeys == .loaded([existingKey]))
    }

    @Test func aRefusalOfTheServerIsShownWithItsMessage() async throws {
        let harness = try await ownerKeyHarness()
        harness.service.failures[.issueOwnerKey] = .fairUseRefused(message: "This account is suspended.")
        await harness.model.issueOwnerKey()
        #expect(harness.model.ownerKeyFailure == .refused(message: "This account is suspended."))
    }

    @Test func anyOtherFailureToCreateIsNotCreated() async throws {
        let harness = try await ownerKeyHarness()
        harness.service.failures[.issueOwnerKey] = .unreachable
        await harness.model.issueOwnerKey()
        #expect(harness.model.ownerKeyFailure == .notCreated)
        #expect(harness.model.issuedOwnerKey == nil)
    }

    @Test func aNewAttemptClearsTheLastFailure() async throws {
        let harness = try await ownerKeyHarness()
        harness.service.failures[.issueOwnerKey] = .unreachable
        await harness.model.issueOwnerKey()
        harness.service.failures[.issueOwnerKey] = nil
        await harness.model.issueOwnerKey()
        #expect(harness.model.ownerKeyFailure == nil)
        #expect(harness.model.issuedOwnerKey != nil)
    }

    @Test func revokingAnOwnerKeyRemovesItFromTheList() async throws {
        let harness = try await ownerKeyHarness()
        await harness.model.loadOwnerKeys()
        await harness.model.revokeOwnerKey(existingKey)
        #expect(harness.model.ownerKeys == .loaded([]))
        #expect(harness.service.calls.contains(.revokeOwnerKey(session: harness.session, keyIdentifier: existingKey.identifier)))
    }

    @Test func revokingAKeyTheServerNoLongerHasStillRemovesIt() async throws {
        let harness = try await ownerKeyHarness()
        await harness.model.loadOwnerKeys()
        harness.service.ownerKeys = []
        await harness.model.revokeOwnerKey(existingKey)
        #expect(harness.model.ownerKeys == .loaded([]))
        #expect(harness.model.ownerKeyFailure == nil)
    }

    @Test func aFailedOwnerKeyRevokeKeepsTheKeyAndSaysSo() async throws {
        let harness = try await ownerKeyHarness()
        await harness.model.loadOwnerKeys()
        harness.service.failures[.revokeOwnerKey] = .unreachable
        await harness.model.revokeOwnerKey(existingKey)
        #expect(harness.model.ownerKeys == .loaded([existingKey]))
        #expect(harness.model.ownerKeyFailure == .notRevoked)
    }

    @Test func leavingTheWindowForgetsTheOwnerKeysAndTheirSecret() async throws {
        let harness = try await ownerKeyHarness()
        await harness.model.issueOwnerKey()
        harness.model.forgetWindow()
        #expect(harness.model.ownerKeys == nil)
        #expect(harness.model.issuedOwnerKey == nil)
        #expect(harness.model.ownerKeyFailure == nil)
    }

    @Test func anIssueAnswerAfterSettingsClosedKeepsNoSecretAndListsNothing() async throws {
        let harness = try await ownerKeyHarness()
        harness.service.suspend(.issueOwnerKey)
        let issuing = Task { await harness.model.issueOwnerKey() }
        await harness.service.held(.issueOwnerKey)
        harness.model.forgetOwnerKeys()
        harness.service.resume(.issueOwnerKey)
        await issuing.value
        #expect(harness.model.issuedOwnerKey == nil)
        #expect(harness.model.ownerKeys == nil)
        #expect(harness.model.ownerKeyFailure == nil)
        #expect(harness.model.isChangingOwnerKeys == false)
        #expect(!harness.service.calls.contains(.listOwnerKeys(session: harness.session)))
    }

    @Test func aListAnswerAfterSettingsClosedIsIgnored() async throws {
        let harness = try await ownerKeyHarness()
        harness.service.suspend(.listOwnerKeys)
        let loading = Task { await harness.model.loadOwnerKeys() }
        await harness.service.held(.listOwnerKeys)
        harness.model.forgetOwnerKeys()
        harness.service.resume(.listOwnerKeys)
        await loading.value
        #expect(harness.model.ownerKeys == nil)
    }

    @Test func theOwnerKeyLimitIsTheServers() {
        #expect(OwnerKeyLimit.liveKeysMax == 5)
    }
}
