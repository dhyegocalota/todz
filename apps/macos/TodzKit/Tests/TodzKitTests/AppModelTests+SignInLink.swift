import Foundation
import Testing
@testable import TodzKit

private let emailAddress = "maria@example.com"
private let otherAddress = "joao@example.com"
private let linkToken = String(repeating: "aB3_-", count: 8) + "xyz"
private let minute: TimeInterval = 60
private let linkLifetime = 15 * minute
private let pendingLifetime = 20 * minute
private let firstVerifier = "verifier-1"
private let secondVerifier = "verifier-2"

private func incomingLink() throws -> SignInLink {
    let url = try #require(URL(string: "todz://sign-in?token=\(linkToken)&turnstile=\(harnessLinkTurnstileToken)&origin=\(harnessDefaultServer)"))
    return try #require(SignInLink(url: url, scheme: .release))
}

private func expectedChallenge(_ verifier: String) -> String {
    SignInLinkChallenge.challenge(for: verifier)
}

@MainActor private func harnessWithAPendingLink(at expiresAt: Date = fixedInstant.addingTimeInterval(pendingLifetime)) throws -> AppModelHarness {
    let harness = try AppModelHarness()
    let pending = PendingSignInLink(email: emailAddress, verifier: firstVerifier, expiresAt: expiresAt)
    harness.pendingLinks.link = pending
    return harness
}

extension AppModelTests {
    @Test(arguments: [SignInMethod.link, .identity])
    func loadingTheMethodKeepsWhatTheServerAnswered(method: SignInMethod) async throws {
        let harness = try AppModelHarness()
        harness.service.signInMethodAnswer = method
        await harness.model.loadSignInMethod()
        #expect(harness.model.signInMethod == method)
        #expect(harness.model.signInError == nil)
        #expect(harness.service.calls == [.signInMethod])
    }

    @Test(arguments: [(OwnerAPIError.signInUnavailable, SignInError.signInUnavailable), (.unreachable, .unreachable), (.unexpected(status: 500), .unexpected)])
    func aMethodThatCannotBeReadLeavesNoMethodAndItsError(failure: OwnerAPIError, expected: SignInError) async throws {
        let harness = try AppModelHarness()
        harness.service.failures[.signInMethod] = failure
        await harness.model.loadSignInMethod()
        #expect(harness.model.signInMethod == nil)
        #expect(harness.model.signInMethodError == expected)
    }

    @Test func askingForALinkSendsTheChallengeOfAFreshVerifierAndKeepsThePendingLink() async throws {
        let harness = try AppModelHarness()
        await harness.askForLink(email: emailAddress)
        let expected = PendingSignInLink(email: emailAddress, verifier: firstVerifier, expiresAt: fixedInstant.addingTimeInterval(pendingLifetime))
        #expect(harness.service.calls == [.requestSignInLink(email: emailAddress, challenge: expectedChallenge(firstVerifier), turnstileToken: harnessChallengeToken, linkScheme: harnessLinkScheme)])
        #expect(harness.model.pendingLink == expected)
        #expect(harness.pendingLinks.link == expected)
        #expect(harness.model.signInError == nil)
        #expect(harness.model.isSigningIn == false)
    }

    @Test(arguments: [
        (OwnerAPIError.signInRefused, SignInError.signInRefused),
        (.signInUnavailable, .signInUnavailable),
        (.unreachable, .unreachable),
        (.invalidRequest, .invalidAddress),
    ])
    func aRefusedAskKeepsNoPendingLinkAndShowsItsError(failure: OwnerAPIError, expected: SignInError) async throws {
        let harness = try AppModelHarness()
        harness.service.failures[.requestSignInLink] = failure
        await harness.askForLink(email: emailAddress)
        #expect(harness.model.signInError == expected)
        #expect(harness.model.pendingLink == nil)
        #expect(harness.pendingLinks.link == nil)
        #expect(harness.model.isSigningIn == false)
    }

    @Test func sendingAgainWithinTheLifetimeReusesTheVerifierAndMovesTheExpiry() async throws {
        let harness = try AppModelHarness()
        await harness.askForLink(email: emailAddress)
        harness.clock.now = fixedInstant.addingTimeInterval(linkLifetime - 1)
        await harness.askForLink(email: emailAddress)
        let challenge = expectedChallenge(firstVerifier)
        #expect(harness.service.calls == [.requestSignInLink(email: emailAddress, challenge: challenge, turnstileToken: harnessChallengeToken, linkScheme: harnessLinkScheme), .requestSignInLink(email: emailAddress, challenge: challenge, turnstileToken: harnessChallengeToken, linkScheme: harnessLinkScheme)])
        #expect(harness.model.pendingLink?.expiresAt == harness.clock.now.addingTimeInterval(pendingLifetime))
        #expect(harness.verifiers.issued == [firstVerifier])
    }

    @Test func sendingAgainAfterTheLifetimeMakesANewVerifier() async throws {
        let harness = try AppModelHarness()
        await harness.askForLink(email: emailAddress)
        harness.clock.now = fixedInstant.addingTimeInterval(linkLifetime)
        await harness.askForLink(email: emailAddress)
        #expect(harness.service.calls.last == .requestSignInLink(email: emailAddress, challenge: expectedChallenge(secondVerifier), turnstileToken: harnessChallengeToken, linkScheme: harnessLinkScheme))
        #expect(harness.model.pendingLink?.verifier == secondVerifier)
    }

    @Test func askingForAnotherAddressMakesANewVerifier() async throws {
        let harness = try AppModelHarness()
        await harness.askForLink(email: emailAddress)
        await harness.askForLink(email: otherAddress)
        #expect(harness.service.calls.last == .requestSignInLink(email: otherAddress, challenge: expectedChallenge(secondVerifier), turnstileToken: harnessChallengeToken, linkScheme: harnessLinkScheme))
        #expect(harness.model.pendingLink == PendingSignInLink(email: otherAddress, verifier: secondVerifier, expiresAt: fixedInstant.addingTimeInterval(pendingLifetime)))
    }

    @Test func aRefusedSendAgainKeepsThePendingLinkTheOwnerAlreadyHas() async throws {
        let harness = try AppModelHarness()
        await harness.askForLink(email: emailAddress)
        harness.service.failures[.requestSignInLink] = .signInRefused
        await harness.askForLink(email: emailAddress)
        #expect(harness.model.signInError == .signInRefused)
        #expect(harness.model.pendingLink?.verifier == firstVerifier)
        #expect(harness.pendingLinks.link?.verifier == firstVerifier)
    }

    @Test func discardingThePendingLinkErasesItFromMemoryAndFromTheVault() async throws {
        let harness = try AppModelHarness()
        await harness.askForLink(email: emailAddress)
        harness.model.discardPendingLink()
        #expect(harness.model.pendingLink == nil)
        #expect(harness.pendingLinks.link == nil)
    }

    @Test func launchRestoresAnUnexpiredPendingLinkAndDropsAnExpiredOne() async throws {
        let kept = try harnessWithAPendingLink()
        await kept.model.launch()
        #expect(kept.model.pendingLink == kept.pendingLinks.link)
        #expect(kept.model.pendingLink?.verifier == firstVerifier)
        let expired = try harnessWithAPendingLink(at: fixedInstant)
        await expired.model.launch()
        #expect(expired.model.pendingLink == nil)
        #expect(expired.pendingLinks.link == nil)
    }

    @Test func redeemingPostsTheTokenWithTheKeptVerifierThenOpensTheSessionAndClearsThePendingLink() async throws {
        let harness = try harnessWithAPendingLink()
        harness.seedWorkspace(name: "acme")
        await harness.model.launch()
        await harness.model.redeem(signInLink: try incomingLink())
        let session = harness.service.issuedSession.sessionToken
        #expect(
            Array(harness.service.calls.prefix(2)) == [
                .signIn(identityToken: linkToken, linkVerifier: firstVerifier, turnstileToken: harnessLinkTurnstileToken, timeZone: harnessTimeZoneIdentifier),
                .listWorkspaces(session: session),
            ]
        )
        #expect(harness.model.phase == .ready)
        #expect(harness.vault.secret == session)
        #expect(harness.model.pendingLink == nil)
        #expect(harness.pendingLinks.link == nil)
        #expect(harness.model.signInError == nil)
    }

    @Test func redeemingAsAnotherOwnerThanTheCachesErasesTheCacheBeforeTheSessionIsStored() async throws {
        let harness = try harnessWithAPendingLink()
        harness.store.owner = OwnerCache(ownerIdentifier: "someone-else", workspaces: [], activeWorkspaceIdentifier: nil)
        await harness.model.launch()
        let isVaultEmptyAtErase = Captured<Bool>()
        harness.store.onCall = { call in
            guard call == .erase else { return }
            isVaultEmptyAtErase.value = harness.vault.secret == nil
        }
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(isVaultEmptyAtErase.value == true)
        #expect(harness.store.owner?.ownerIdentifier == harness.ownerIdentifier)
        #expect(harness.vault.secret == harness.service.issuedSession.sessionToken)
    }

    @Test func aLinkWithNoPendingRequestSendsNothingAndSaysSo() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.service.calls == [])
        #expect(harness.model.signInError == .linkNotRequested)
        #expect(harness.model.phase == .signedOut(notice: nil))
    }

    @Test func aLinkAfterThePendingLinkExpiredSendsNothingAndClearsIt() async throws {
        let harness = try harnessWithAPendingLink()
        await harness.model.launch()
        harness.clock.now = fixedInstant.addingTimeInterval(pendingLifetime)
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.service.calls == [])
        #expect(harness.model.signInError == .linkNotRequested)
        #expect(harness.model.pendingLink == nil)
        #expect(harness.pendingLinks.link == nil)
    }

    @Test func aLinkWhileSignedInSendsNothingAndSaysTheOwnerIsAlreadySignedIn() async throws {
        let harness = try harnessWithAPendingLink()
        harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.service.calls == [])
        #expect(harness.model.signInError == nil)
        #expect(harness.model.phase == .ready)
        #expect(harness.model.banner == .alreadySignedIn)
        #expect(harness.model.canRedeemAgain == false)
    }

    @Test func aLinkWhileSignedInKeepsAnErrorBannerAlreadyShowing() async throws {
        let harness = try harnessWithAPendingLink()
        harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        harness.model.raise(.network)
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.model.banner == .network)
    }

    @Test func theAlreadySignedInLineGoesWhenTheOwnerDismissesIt() async throws {
        let harness = try harnessWithAPendingLink()
        harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        await harness.model.redeem(signInLink: try incomingLink())
        harness.model.dismissBanner()
        #expect(harness.model.banner == nil)
    }

    @Test func aLinkOpenedWhileThePickerShowsSaysTheOwnerIsAlreadySignedIn() async throws {
        let harness = try harnessWithAPendingLink()
        harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "side")
        await harness.signedIn()
        #expect(harness.model.phase == .choosing)
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.model.banner == .alreadySignedIn)
    }

    @Test func aLinkHeldUntilTheLaunchSettlesSaysTheOwnerIsAlreadySignedIn() async throws {
        let harness = try harnessWithAPendingLink()
        harness.seedWorkspace(name: "acme")
        harness.vault.secret = harness.session
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.model.banner == nil)
        await harness.model.launch()
        #expect(harness.model.banner == .alreadySignedIn)
    }

    @Test func aLinkWhileNamingTheFirstWorkspaceSaysTheOwnerIsAlreadySignedIn() async throws {
        let harness = try harnessWithAPendingLink()
        await harness.signedIn()
        #expect(harness.model.phase == .naming)
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.model.banner == .alreadySignedIn)
    }

    @Test func aLinkWhileTheSessionIsStillLoadingRaisesNoBanner() async throws {
        let harness = try harnessWithAPendingLink()
        await harness.model.launch()
        harness.model.phase = .loading
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.model.banner == nil)
    }

    @Test func signingOutTakesTheAlreadySignedInLineAway() async throws {
        let harness = try harnessWithAPendingLink()
        harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        await harness.model.redeem(signInLink: try incomingLink())
        await harness.model.signOut()
        #expect(harness.model.banner == nil)
    }

    @Test func aSessionThatEndsTakesTheAlreadySignedInLineAway() async throws {
        let harness = try harnessWithAPendingLink()
        harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        await harness.model.redeem(signInLink: try incomingLink())
        harness.model.endSession()
        #expect(harness.model.banner == nil)
    }

    @Test func aLinkWhileSignedOutRaisesNoBanner() async throws {
        let harness = try harnessWithAPendingLink()
        await harness.model.launch()
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.model.banner == nil)
    }

    @Test func aRejectedLinkKeepsAnUnexpiredPendingLinkAndSaysTheLinkWasRejected() async throws {
        let harness = try harnessWithAPendingLink()
        await harness.model.launch()
        harness.service.failures[.signIn] = .identityRejected
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.model.signInError == .linkRejected)
        #expect(harness.model.pendingLink?.verifier == firstVerifier)
        #expect(harness.pendingLinks.link?.verifier == firstVerifier)
        #expect(harness.model.phase == .signedOut(notice: nil))
        #expect(harness.vault.secret == nil)
    }

    @Test func aRejectedLinkClearsThePendingLinkThatExpiredWhileItWasBeingRedeemed() async throws {
        let harness = try harnessWithAPendingLink(at: fixedInstant.addingTimeInterval(minute))
        await harness.model.launch()
        harness.service.failures[.signIn] = .identityRejected
        harness.service.onCall = { _ in harness.clock.now = fixedInstant.addingTimeInterval(2 * minute) }
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.model.signInError == .linkRejected)
        #expect(harness.model.pendingLink == nil)
        #expect(harness.pendingLinks.link == nil)
    }

    @Test func anOfflineRedeemKeepsThePendingLinkSoTheSameLinkCanBeRedeemedAgain() async throws {
        let harness = try harnessWithAPendingLink()
        harness.seedWorkspace(name: "acme")
        await harness.model.launch()
        harness.service.failures[.signIn] = .unreachable
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.model.signInError == .unreachable)
        #expect(harness.model.pendingLink?.verifier == firstVerifier)
        harness.service.failures = [:]
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.model.phase == .ready)
        #expect(harness.model.signInError == nil)
        #expect(harness.pendingLinks.link == nil)
    }

    @Test func aLinkThatArrivesBeforeLaunchSettlesIsRedeemedOnceSignedOut() async throws {
        let harness = try harnessWithAPendingLink()
        harness.seedWorkspace(name: "acme")
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.service.calls == [])
        await harness.model.launch()
        #expect(harness.service.calls.first == .signIn(identityToken: linkToken, linkVerifier: firstVerifier, turnstileToken: harnessLinkTurnstileToken, timeZone: harnessTimeZoneIdentifier))
        #expect(harness.model.phase == .ready)
        #expect(harness.pendingLinks.link == nil)
    }

    @Test func aLinkHeldBeforeLaunchSurvivesAnExpiredStoredPendingLinkAndSaysSo() async throws {
        let harness = try harnessWithAPendingLink(at: fixedInstant)
        await harness.model.redeem(signInLink: try incomingLink())
        await harness.model.launch()
        #expect(harness.service.calls == [])
        #expect(harness.model.signInError == .linkNotRequested)
        #expect(harness.pendingLinks.link == nil)
    }

    @Test func aLinkThatArrivesBeforeLaunchSettlesIsDroppedOnceSignedIn() async throws {
        let harness = try harnessWithAPendingLink()
        harness.seedWorkspace(name: "acme")
        harness.vault.secret = harness.session
        await harness.model.redeem(signInLink: try incomingLink())
        await harness.model.launch()
        #expect(harness.service.routes().contains(.signIn) == false)
        #expect(harness.model.signInError == nil)
        #expect(harness.model.phase == .ready)
    }

    @Test func aLinkThatArrivesBeforeLaunchWithNoPendingRequestSaysSoOnceSignedOut() async throws {
        let harness = try AppModelHarness()
        await harness.model.redeem(signInLink: try incomingLink())
        await harness.model.launch()
        #expect(harness.service.calls == [])
        #expect(harness.model.signInError == .linkNotRequested)
    }
}
