import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let otherText = "http://localhost:8791"
private let storedText = "https://todz.example.com"
private let linkToken = String(repeating: "aB3_-", count: 8) + "xyz"
private let emailAddress = "maria@example.com"

private final class EventLog {
    var events: [String] = []
}

private func address(_ text: String) throws -> ServerAddress {
    try ServerAddress.checked(text: text).get()
}

private func incomingLink(origin: String = harnessDefaultServer) throws -> SignInLink {
    let url = try #require(URL(string: "todz://sign-in?token=\(linkToken)&turnstile=\(harnessLinkTurnstileToken)&origin=\(origin)"))
    return try #require(SignInLink(url: url, scheme: .release))
}

extension AppModelTests {
    @MainActor private func signedInHarness() async throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 2)
        await harness.signedIn()
        return harness
    }

    @MainActor private func harnessWithAPendingLink() async throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.pendingLinks.link = PendingSignInLink(email: emailAddress, verifier: "verifier-0", expiresAt: fixedInstant.addingTimeInterval(harnessPendingLifetime))
        await harness.model.launch()
        harness.service.calls = []
        return harness
    }

    @Test func switchingSignedInErasesEverythingRebuildsForTheNewAddressAndSignsOutAtTheOldServer() async throws {
        let harness = try await signedInHarness()
        harness.service.failures[.addTasks] = .unreachable
        await harness.model.addTask(title: "Call the bank", projectIdentifier: inboxIdentifier, dueDate: nil)
        harness.service.calls = []
        harness.store.calls = []
        let other = try address(otherText)
        let result = await harness.model.switchServer(to: other)
        await harness.signedOutAtTheOldServer()
        #expect(result == .switched)
        #expect(harness.model.serverURL == other)
        #expect(harness.servers.addresses == [harness.defaultURL, other])
        #expect(harness.model.phase == .signedOut(notice: nil))
        #expect(harness.vault.secret == nil)
        #expect(harness.store.routes().contains(.erase))
        #expect(harness.store.outbox == nil)
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.pendingLinks.eraseCount == 1)
        #expect(harness.widgets.routes().contains(.erase))
        #expect(harness.preference.storedAddress() == other)
        #expect(harness.service.calls == [.signOut(session: harness.session)])
        #expect(harness.servers.created.map(\.service.calls) == [[]])
    }

    @Test func switchingSignedOutDoesNotSignOutAnywhere() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        let result = await harness.model.switchServer(to: try address(otherText))
        await harness.signedOutAtTheOldServer()
        #expect(result == .switched)
        #expect(harness.service.calls == [])
        #expect(harness.model.phase == .signedOut(notice: nil))
    }

    @Test func aSignOutThatThrowsStillSwitches() async throws {
        let harness = try await signedInHarness()
        harness.service.failures[.signOut] = .unreachable
        let result = await harness.model.switchServer(to: try address(otherText))
        await harness.signedOutAtTheOldServer()
        #expect(result == .switched)
        #expect(harness.vault.secret == nil)
        #expect(harness.model.serverURL == (try address(otherText)))
    }

    @Test func aThrowingStoreEraseKeepsTheOldAddressAndNeverCallsTheFactory() async throws {
        let harness = try await signedInHarness()
        harness.store.failures[.erase] = .unwritable
        let result = await harness.model.switchServer(to: try address(otherText))
        #expect(result == .eraseFailed)
        #expect(harness.model.serverURL == harness.defaultURL)
        #expect(harness.servers.addresses == [harness.defaultURL])
        #expect(harness.preference.storedAddress() == nil)
        #expect(harness.service.calls == [])
    }

    @Test func aThrowingVaultEraseStopsTheSwitchBeforeTheFactory() async throws {
        let harness = try await signedInHarness()
        harness.vault.isUnerasable = true
        let result = await harness.model.switchServer(to: try address(otherText))
        #expect(result == .eraseFailed)
        #expect(harness.servers.addresses == [harness.defaultURL])
        #expect(harness.preference.storedAddress() == nil)
        #expect(harness.model.serverURL == harness.defaultURL)
    }

    @Test func aThrowingPendingLinkEraseStopsTheSwitchBeforeTheFactory() async throws {
        let harness = try await signedInHarness()
        harness.pendingLinks.isUnerasable = true
        let result = await harness.model.switchServer(to: try address(otherText))
        #expect(result == .eraseFailed)
        #expect(harness.servers.addresses == [harness.defaultURL])
        #expect(harness.preference.storedAddress() == nil)
        #expect(harness.model.serverURL == harness.defaultURL)
    }

    @Test func theSameAddressChangesNothingAndCallsNothing() async throws {
        let harness = try await signedInHarness()
        let result = await harness.model.switchServer(to: harness.defaultURL)
        #expect(result == .alreadyInUse)
        #expect(harness.service.calls == [])
        #expect(harness.store.routes().contains(.erase) == false)
        #expect(harness.vault.eraseCount == 0)
        #expect(harness.servers.addresses == [harness.defaultURL])
        #expect(harness.probes.addresses == [])
    }

    @Test func switchingBackToTheDefaultForgetsTheStoredAddress() async throws {
        let harness = try AppModelHarness(storedServer: storedText)
        await harness.model.launch()
        let result = await harness.model.switchServer(to: harness.defaultURL)
        #expect(result == .switched)
        #expect(harness.model.serverURL == harness.defaultURL)
        #expect(harness.preference.storedAddress() == nil)
    }

    @Test func aSwitchLeavesTheSignInStateClear() async throws {
        let harness = try await harnessWithAPendingLink()
        harness.model.acceptChallenge(token: harnessChallengeToken)
        await harness.model.loadSignInMethod()
        harness.service.failures[.signIn] = .identityRejected
        await harness.model.signIn(identity: "maria")
        harness.model.issuedKey = harness.service.nextIssuedKey()
        let roundBefore = harness.model.challengeRound
        let result = await harness.model.switchServer(to: try address(otherText))
        #expect(result == .switched)
        #expect(harness.model.signInChallengeToken == nil)
        #expect(harness.model.signInMethod == nil)
        #expect(harness.model.signInMethodError == nil)
        #expect(harness.model.signInError == nil)
        #expect(harness.model.lastIdentity == nil)
        #expect(harness.model.pendingLink == nil)
        #expect(harness.model.challengeRound == roundBefore + 1)
        #expect(harness.model.keys == nil)
        #expect(harness.model.issuedKey == nil)
    }

    @Test func aLinkFromTheOldServersMailIsNotRequestedAfterTheSwitch() async throws {
        let harness = try await harnessWithAPendingLink()
        await harness.model.switchServer(to: try address(otherText))
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.model.signInError == .linkNotRequested)
        #expect(harness.service.routes().contains(.signIn) == false)
        #expect(harness.servers.created.map(\.service.calls) == [[]])
    }

    @Test func aLinkHandedOverByAnotherServersPageIsNotRequestedAndSendsNothing() async throws {
        let harness = try await harnessWithAPendingLink()
        await harness.model.redeem(signInLink: try incomingLink(origin: storedText))
        #expect(harness.model.signInError == .linkNotRequested)
        #expect(harness.service.calls == [])
        #expect(harness.model.pendingLink != nil)
        #expect(harness.model.phase == .signedOut(notice: nil))
    }

    @Test func aSwitchWhileSigningInIsRefusedAndCallsNothing() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        harness.service.suspend(.signIn)
        let signingIn = Task { await harness.model.signIn(identity: "maria") }
        await harness.service.held(.signIn)
        let result = await harness.model.switchServer(to: try address(otherText))
        #expect(result == .busy)
        #expect(harness.servers.addresses == [harness.defaultURL])
        #expect(harness.vault.eraseCount == 0)
        #expect(harness.store.routes().contains(.erase) == false)
        harness.service.unsuspend(.signIn)
        harness.service.resume(.signIn)
        await signingIn.value
    }

    @Test func aSwitchWhileRequestingALinkIsRefusedAndCallsNothing() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        harness.service.suspend(.requestSignInLink)
        harness.model.acceptChallenge(token: harnessChallengeToken)
        let requesting = Task { await harness.model.requestSignInLink(email: emailAddress) }
        await harness.service.held(.requestSignInLink)
        let result = await harness.model.switchServer(to: try address(otherText))
        #expect(result == .busy)
        #expect(harness.servers.addresses == [harness.defaultURL])
        #expect(harness.pendingLinks.eraseCount == 0)
        harness.service.unsuspend(.requestSignInLink)
        harness.service.resume(.requestSignInLink)
        await requesting.value
    }

    @Test func aRedeemWhoseSigningInFlagWasLostFinishingAfterASwitchIsDroppedAndSignedOutAtItsService() async throws {
        let harness = try await harnessWithAPendingLink()
        harness.service.suspend(.signIn)
        let link = try incomingLink()
        let redeeming = Task { await harness.model.redeem(signInLink: link) }
        await harness.service.held(.signIn)
        harness.model.isSigningIn = false
        let result = await harness.model.switchServer(to: try address(otherText))
        harness.service.unsuspend(.signIn)
        harness.service.resume(.signIn)
        await redeeming.value
        #expect(result == .switched)
        #expect(harness.servers.created.map(\.service.calls) == [[]])
        #expect(harness.service.calls.last == .signOut(session: harness.service.issuedSession.sessionToken))
        #expect(harness.model.phase == .signedOut(notice: nil))
        #expect(harness.vault.secret == nil)
    }

    @Test func aLinkRequestWhoseRequestingFlagWasLostFinishingAfterASwitchKeepsNoPendingLink() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        harness.service.suspend(.requestSignInLink)
        harness.model.acceptChallenge(token: harnessChallengeToken)
        let requesting = Task { await harness.model.requestSignInLink(email: emailAddress) }
        await harness.service.held(.requestSignInLink)
        harness.model.isRequestingLink = false
        await harness.model.switchServer(to: try address(otherText))
        harness.service.unsuspend(.requestSignInLink)
        harness.service.resume(.requestSignInLink)
        await requesting.value
        #expect(harness.model.pendingLink == nil)
        #expect(harness.pendingLinks.link == nil)
        #expect(harness.model.signInError == nil)
    }

    @Test(arguments: [nil, OwnerAPIError.unreachable])
    func aMethodLoadFinishingAfterASwitchIsDropped(failure: OwnerAPIError?) async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        harness.service.suspend(.signInMethod)
        let loading = Task { await harness.model.loadSignInMethod() }
        await harness.service.held(.signInMethod)
        await harness.model.switchServer(to: try address(otherText))
        harness.service.failures[.signInMethod] = failure
        harness.service.unsuspend(.signInMethod)
        harness.service.resume(.signInMethod)
        await loading.value
        #expect(harness.model.signInMethod == nil)
        #expect(harness.model.signInMethodError == nil)
    }

    @Test func theAddressIsStoredAfterTheRebuildWithNothingBetweenTheEraseAndTheStore() async throws {
        let harness = try await signedInHarness()
        let log = EventLog()
        let storedAtRebuild = Captured<ServerAddress?>()
        harness.vault.onErase = { log.events.append("vault") }
        harness.store.onCall = { call in
            guard call == .erase else { return }
            log.events.append("store")
        }
        harness.pendingLinks.onErase = { log.events.append("pendingLink") }
        harness.servers.onConnect = { _ in
            log.events.append("factory")
            storedAtRebuild.value = harness.preference.storedAddress()
        }
        harness.service.onCall = { call in
            guard call.route == .signOut else { return }
            log.events.append("signOut")
        }
        await harness.model.switchServer(to: try address(otherText))
        await harness.signedOutAtTheOldServer()
        #expect(log.events == ["vault", "store", "pendingLink", "factory", "signOut"])
        #expect(storedAtRebuild.value == .some(nil))
        #expect(harness.preference.storedAddress() == (try address(otherText)))
    }

    @Test func aSignOutHeldAtTheOldServerDoesNotDelayTheSwitch() async throws {
        let harness = try await signedInHarness()
        harness.service.suspend(.signOut)
        let result = await harness.model.switchServer(to: try address(otherText))
        #expect(result == .switched)
        await harness.service.held(.signOut)
        #expect(harness.service.calls == [.signOut(session: harness.session)])
        harness.service.unsuspend(.signOut)
        harness.service.resume(.signOut)
        await harness.signedOutAtTheOldServer()
    }

    @Test func theOldChangeWatchIsCancelledBeforeTheNewServerIsBuilt() async throws {
        let harness = try await signedInHarness()
        let key = harness.watchKey(inboxIdentifier)
        await harness.signals.opened(key)
        let cancellationsAtRebuild = Captured<Int>()
        harness.servers.onConnect = { _ in cancellationsAtRebuild.value = harness.signals.cancellationCount(of: key) }
        await harness.model.switchServer(to: try address(otherText))
        await harness.signals.cancelled(key)
        #expect(harness.signals.cancellationCount(of: key) == 1)
        #expect(harness.model.watches.isEmpty)
    }

    @Test func aNewModelStartsOnTheStoredAddress() async throws {
        let harness = try AppModelHarness(storedServer: storedText)
        let stored = try address(storedText)
        #expect(harness.model.serverURL == stored)
        #expect(harness.servers.addresses == [stored])
    }

    @Test func aNewModelWithNothingStoredStartsOnTheDefault() async throws {
        let harness = try AppModelHarness()
        #expect(harness.model.serverURL == harness.defaultURL)
        #expect(harness.servers.addresses == [harness.defaultURL])
    }

    @Test func anUnreadableStoredAddressErasesTheSessionBeforeLaunch() async throws {
        let harness = try AppModelHarness(storedServer: "not a url", isLocalDataKept: true)
        #expect(harness.vault.secret == nil)
        #expect(harness.store.owner == nil)
        #expect(harness.store.outbox == nil)
        #expect(harness.pendingLinks.link == nil)
        await harness.model.launch()
        #expect(harness.model.phase == .signedOut(notice: nil))
        #expect(harness.service.calls == [])
        #expect(harness.servers.addresses == [harness.defaultURL])
        #expect(harness.model.serverURL == harness.defaultURL)
        #expect(!harness.preference.hasUnreadableValue)
    }

    @Test func anUnreadableStoredAddressWhoseEraseFailsLaunchesSignedOutWithoutReadingTheSession() async throws {
        let harness = try AppModelHarness(storedServer: "not a url", isLocalDataKept: true, isVaultUnerasable: true)
        await harness.model.launch()
        #expect(harness.model.phase == .signedOut(notice: .sessionUnreadable))
        #expect(harness.service.calls == [])
        #expect(harness.preference.hasUnreadableValue)
    }

    @Test func aSessionBoundToAnotherServerIsErasedBeforeLaunchAndNoCallCarriesIt() async throws {
        let harness = try AppModelHarness(isLocalDataKept: true, sessionOrigin: storedText)
        #expect(harness.vault.secret == nil)
        #expect(harness.store.owner == nil)
        #expect(harness.store.outbox == nil)
        #expect(harness.pendingLinks.link == nil)
        await harness.model.launch()
        #expect(harness.model.phase == .signedOut(notice: nil))
        #expect(harness.service.calls == [])
        #expect(harness.model.serverURL == harness.defaultURL)
    }

    @Test func anEarlierBuildsSessionWithNoStoredServerIsBoundToTheDefaultAndKeepsTheCacheAndOutbox() async throws {
        let harness = try AppModelHarness(defaultServer: storedText, isLocalDataKept: true, sessionOrigin: nil)
        #expect(harness.vault.secret == harness.session)
        #expect(harness.vault.origin == storedText)
        #expect(harness.vault.eraseCount == 0)
        #expect(harness.store.owner != nil)
        #expect(harness.store.outbox != nil)
        #expect(harness.pendingLinks.link != nil)
        await harness.model.launch()
        #expect(harness.model.isSignedIn)
        #expect(harness.model.phase != .signedOut(notice: .sessionUnreadable))
    }

    @Test func anEarlierBuildsSessionIsErasedWhenTheDefaultServerIsLoopback() async throws {
        let harness = try AppModelHarness(isLocalDataKept: true, sessionOrigin: nil)
        #expect(harness.vault.secret == nil)
        #expect(harness.vault.origin == nil)
        #expect(harness.store.owner == nil)
        await harness.model.launch()
        #expect(harness.model.phase == .signedOut(notice: nil))
        #expect(harness.service.calls == [])
    }

    @Test func aSessionWhoseServerChangesBetweenTheTwoLaunchReadsIsErasedAndNoCallCarriesIt() async throws {
        let harness = try AppModelHarness(isLocalDataKept: true)
        harness.vault.origin = storedText
        await harness.model.launch()
        #expect(harness.vault.secret == nil)
        #expect(harness.model.phase == .signedOut(notice: nil))
        #expect(harness.model.isSignedIn == false)
        #expect(harness.service.calls == [])
    }

    @Test func anEarlierBuildsSessionWithAStoredServerIsErasedBeforeLaunchAndNoCallCarriesIt() async throws {
        let harness = try AppModelHarness(storedServer: storedText, isLocalDataKept: true, sessionOrigin: nil)
        #expect(harness.vault.secret == nil)
        #expect(harness.store.owner == nil)
        #expect(harness.store.outbox == nil)
        #expect(harness.pendingLinks.link == nil)
        await harness.model.launch()
        #expect(harness.model.phase == .signedOut(notice: nil))
        #expect(harness.service.calls == [])
        #expect(harness.model.serverURL == (try address(storedText)))
    }

    @Test func aSessionBoundToAnotherServerWhoseEraseFailsLaunchesSignedOutWithoutReadingIt() async throws {
        let harness = try AppModelHarness(isLocalDataKept: true, sessionOrigin: storedText, isVaultUnerasable: true)
        await harness.model.launch()
        #expect(harness.model.phase == .signedOut(notice: .sessionUnreadable))
        #expect(harness.service.calls == [])
    }

    @Test func aSessionBoundToTheServerInUseIsKept() async throws {
        let harness = try AppModelHarness(isLocalDataKept: true)
        #expect(harness.vault.secret == harness.session)
        #expect(harness.vault.eraseCount == 0)
        #expect(harness.store.owner != nil)
    }

    @Test func aSessionOpenedOnAStoredServerIsBoundToIt() async throws {
        let harness = try AppModelHarness(storedServer: storedText)
        await harness.model.launch()
        await harness.model.signIn(identity: "maria")
        #expect(harness.vault.secret == harness.service.issuedSession.sessionToken)
        #expect(harness.vault.origin == storedText)
    }

    @Test func theModelSaysWhetherItIsSignedInAndWhetherItIsOnTheDefaultServer() async throws {
        let harness = try await signedInHarness()
        #expect(harness.model.isSignedIn)
        #expect(harness.model.isOnDefaultServer)
        await harness.model.switchServer(to: try address(otherText))
        #expect(!harness.model.isSignedIn)
        #expect(!harness.model.isOnDefaultServer)
        await harness.model.switchServer(to: harness.defaultURL)
        #expect(harness.model.isOnDefaultServer)
    }

    @Test func probingAsksTheInjectedProbeOncePerCheck() async throws {
        let harness = try AppModelHarness()
        let other = try address(otherText)
        harness.probes.outcome = .notTodz
        let outcome = await harness.model.probeServer(other)
        #expect(outcome == .notTodz)
        #expect(harness.probes.addresses == [other])
    }
}
