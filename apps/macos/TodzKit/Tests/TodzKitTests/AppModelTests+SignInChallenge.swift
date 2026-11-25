import Foundation
import Testing
@testable import TodzKit

private let emailAddress = "maria@example.com"
private let linkToken = String(repeating: "aB3_-", count: 8) + "xyz"
private let pendingLifetime: TimeInterval = 20 * 60
private let firstVerifier = "verifier-1"
private let otherChallengeToken = "other-challenge-token"
private let longestChallengeToken = String(repeating: "a", count: 2048)
private let malformedChallengeTokens = ["", "bad token", "bad!token", longestChallengeToken + "a"]

private func incomingLink() throws -> SignInLink {
    let url = try #require(URL(string: "todz://sign-in?token=\(linkToken)&turnstile=\(harnessLinkTurnstileToken)&origin=\(harnessDefaultServer)"))
    return try #require(SignInLink(url: url, scheme: .release))
}

@MainActor private func harnessWithAPendingLink() throws -> AppModelHarness {
    let harness = try AppModelHarness()
    harness.pendingLinks.link = PendingSignInLink(email: emailAddress, verifier: firstVerifier, expiresAt: fixedInstant.addingTimeInterval(pendingLifetime))
    return harness
}

extension AppModelTests {
    @Test func aWellFormedChallengeTokenIsKept() async throws {
        let harness = try AppModelHarness()
        harness.model.acceptChallenge(token: harnessChallengeToken)
        #expect(harness.model.signInChallengeToken == harnessChallengeToken)
    }

    @Test func aTokenOfTheLongestLengthIsKept() async throws {
        let harness = try AppModelHarness()
        harness.model.acceptChallenge(token: longestChallengeToken)
        #expect(harness.model.signInChallengeToken == longestChallengeToken)
    }

    @Test(arguments: malformedChallengeTokens)
    func anEmptyOrMalformedChallengeTokenClearsTheHeldOne(token: String) async throws {
        let harness = try AppModelHarness()
        harness.model.acceptChallenge(token: harnessChallengeToken)
        harness.model.acceptChallenge(token: token)
        #expect(harness.model.signInChallengeToken == nil)
    }

    @Test func aNewChallengeTokenReplacesTheHeldOne() async throws {
        let harness = try AppModelHarness()
        harness.model.acceptChallenge(token: harnessChallengeToken)
        harness.model.acceptChallenge(token: otherChallengeToken)
        #expect(harness.model.signInChallengeToken == otherChallengeToken)
    }

    @Test func askingWithoutAChallengeTokenSendsNothingAndLeavesTheErrorAndTheRoundAlone() async throws {
        let harness = try AppModelHarness()
        harness.service.failures[.requestSignInLink] = .signInRefused
        await harness.askForLink(email: emailAddress)
        let roundBefore = harness.model.challengeRound
        harness.service.failures = [:]
        await harness.model.requestSignInLink(email: emailAddress)
        #expect(harness.service.calls.count == 1)
        #expect(harness.model.signInError == .signInRefused)
        #expect(harness.model.challengeRound == roundBefore)
        #expect(harness.model.isRequestingLink == false)
    }

    @Test func askingWithoutAChallengeTokenLeavesNoErrorWhereThereWasNone() async throws {
        let harness = try AppModelHarness()
        await harness.model.requestSignInLink(email: emailAddress)
        #expect(harness.service.calls == [])
        #expect(harness.model.signInError == nil)
        #expect(harness.model.pendingLink == nil)
    }

    @Test func askingSendsTheHeldChallengeTokenThenClearsItAndAdvancesTheRound() async throws {
        let harness = try AppModelHarness()
        harness.model.acceptChallenge(token: harnessChallengeToken)
        let roundBefore = harness.model.challengeRound
        await harness.model.requestSignInLink(email: emailAddress)
        let challenge = SignInLinkChallenge.challenge(for: firstVerifier)
        #expect(harness.service.calls == [.requestSignInLink(email: emailAddress, challenge: challenge, turnstileToken: harnessChallengeToken, linkScheme: harnessLinkScheme)])
        #expect(harness.model.signInChallengeToken == nil)
        #expect(harness.model.challengeRound == roundBefore + 1)
    }

    @Test(arguments: [OwnerAPIError.signInRefused, .unreachable, .invalidRequest])
    func aFailedAskClearsTheChallengeTokenAndAdvancesTheRoundToo(failure: OwnerAPIError) async throws {
        let harness = try AppModelHarness()
        harness.service.failures[.requestSignInLink] = failure
        harness.model.acceptChallenge(token: harnessChallengeToken)
        let roundBefore = harness.model.challengeRound
        await harness.model.requestSignInLink(email: emailAddress)
        #expect(harness.model.signInError != nil)
        #expect(harness.model.signInChallengeToken == nil)
        #expect(harness.model.challengeRound == roundBefore + 1)
    }

    @Test func redeemingSendsTheLinksTurnstileTokenNotTheHeldChallengeToken() async throws {
        let harness = try harnessWithAPendingLink()
        harness.seedWorkspace(name: "acme")
        await harness.model.launch()
        harness.model.acceptChallenge(token: harnessChallengeToken)
        await harness.model.redeem(signInLink: try incomingLink())
        let expected = FakeCall.signIn(
            identityToken: linkToken,
            linkVerifier: firstVerifier,
            turnstileToken: harnessLinkTurnstileToken,
            timeZone: harnessTimeZoneIdentifier
        )
        #expect(harness.service.calls.first == expected)
        #expect(harness.model.signInChallengeToken == harnessChallengeToken)
    }

    @Test func aRefusedRedeemShowsTheLinkRefusalKeepsThePendingLinkAndDoesNotHoldTheLink() async throws {
        let harness = try harnessWithAPendingLink()
        await harness.model.launch()
        harness.service.failures[.signIn] = .signInRefused
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.model.signInError == .linkRefused)
        #expect(harness.model.pendingLink?.verifier == firstVerifier)
        #expect(harness.pendingLinks.link?.verifier == firstVerifier)
        #expect(harness.model.canRedeemAgain == false)
    }

    @Test func aRefusedRedeemStaysOnTheInboxStage() async throws {
        let harness = try harnessWithAPendingLink()
        harness.service.signInMethodAnswer = .link
        await harness.model.launch()
        await harness.model.loadSignInMethod()
        harness.service.failures[.signIn] = .signInRefused
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(SignInStage(model: harness.model) == .awaitingLink)
    }

    @Test func theIdentityMethodSignsInWithoutATurnstileToken() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        harness.model.acceptChallenge(token: harnessChallengeToken)
        await harness.model.signIn(identity: "dhyego")
        let expected = FakeCall.signIn(identityToken: "dhyego", linkVerifier: nil, turnstileToken: nil, timeZone: harnessTimeZoneIdentifier)
        #expect(harness.service.calls.first == expected)
    }
}
