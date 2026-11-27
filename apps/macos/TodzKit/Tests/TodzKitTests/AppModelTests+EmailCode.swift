import Foundation
import Testing
@testable import TodzKit

private let emailAddress = "maria@example.com"
private let code = "482913"
private let firstVerifier = "kept-verifier"
private let secondVerifier = "verifier-1"
private let pendingLifetime: TimeInterval = 20 * 60
private let lockedWait = 120

@MainActor private func harnessAskingForACode() async throws -> AppModelHarness {
    let harness = try AppModelHarness()
    harness.pendingLinks.link = PendingSignInLink(email: emailAddress, verifier: firstVerifier, expiresAt: fixedInstant.addingTimeInterval(pendingLifetime))
    harness.seedWorkspace(name: "acme")
    harness.service.signInMethodAnswer = .link
    await harness.model.launch()
    await harness.model.loadSignInMethod()
    harness.service.calls = []
    harness.model.acceptChallenge(token: harnessChallengeToken)
    return harness
}

extension AppModelTests {
    @Test func aCodeSignsInWithTheEmailTheKeptVerifierAndAFreshChallenge() async throws {
        let harness = try await harnessAskingForACode()
        await harness.model.signIn(code: code)
        #expect(
            harness.service.calls.first == .signInWithCode(email: emailAddress, emailCode: code, linkVerifier: firstVerifier, turnstileToken: harnessChallengeToken, timeZone: harnessTimeZoneIdentifier)
        )
        #expect(harness.model.phase == .ready)
        #expect(harness.model.pendingLink == nil)
        #expect(harness.pendingLinks.link == nil)
        #expect(harness.vault.secret == harness.service.issuedSession.sessionToken)
    }

    @Test func aCodeWaitsForTheChallengeInsteadOfSendingWithout() async throws {
        let harness = try await harnessAskingForACode()
        harness.model.acceptChallenge(token: "")
        await harness.model.signIn(code: code)
        #expect(harness.service.calls.isEmpty)
        #expect(harness.model.codeFailureCount == 0)
    }

    @Test func aWrongCodeIsToldAsOneKeepsTheRequestAndSpendsTheChallenge() async throws {
        let harness = try await harnessAskingForACode()
        harness.service.failures[.signInWithCode] = .identityRejected
        let roundBefore = harness.model.challengeRound
        await harness.model.signIn(code: code)
        #expect(harness.model.signInError == .codeRejected)
        #expect(harness.model.codeFailureCount == 1)
        #expect(harness.model.pendingLink?.verifier == firstVerifier)
        #expect(harness.model.signInChallengeToken == nil)
        #expect(harness.model.challengeRound == roundBefore + 1)
        #expect(SignInStage(model: harness.model) == .awaitingLink)
    }

    @Test func eachWrongCodeCountsOneFailureForTheShake() async throws {
        let harness = try await harnessAskingForACode()
        harness.service.failures[.signInWithCode] = .identityRejected
        await harness.model.signIn(code: code)
        harness.model.acceptChallenge(token: harnessChallengeToken)
        await harness.model.signIn(code: code)
        #expect(harness.model.codeFailureCount == 2)
    }

    @Test func tooManyWrongCodesShowTheWaitTheServerSent() async throws {
        let harness = try await harnessAskingForACode()
        harness.service.failures[.signInWithCode] = .codeLocked(retryAfterSeconds: lockedWait)
        await harness.model.signIn(code: code)
        #expect(harness.model.signInError == .codeLocked(retryAfterSeconds: lockedWait))
        #expect(harness.model.codeFailureCount == 0)
        #expect(SignInStage(model: harness.model) == .awaitingLink)
    }

    @Test func theCodeFieldStaysOnScreenWhileTheCodeIsChecked() async throws {
        let harness = try await harnessAskingForACode()
        harness.service.suspend(.signInWithCode)
        let submission = Task { await harness.model.signIn(code: code) }
        await harness.service.held(.signInWithCode)
        #expect(harness.model.isSigningIn)
        #expect(SignInStage(model: harness.model) == .awaitingLink)
        harness.service.unsuspend(.signInWithCode)
        harness.service.resume(.signInWithCode)
        await submission.value
        #expect(!harness.model.isSubmittingCode)
    }

    @Test func resendingACodeAsksForANewLinkWithANewVerifier() async throws {
        let harness = try await harnessAskingForACode()
        await harness.model.resendCode()
        #expect(
            harness.service.calls == [
                .requestSignInLink(email: emailAddress, challenge: SignInLinkChallenge.challenge(for: secondVerifier), turnstileToken: harnessChallengeToken, linkScheme: harnessLinkScheme)
            ]
        )
        #expect(harness.model.pendingLink?.verifier == secondVerifier)
    }

    @Test func resendingWithNoRequestAsksForNothing() async throws {
        let harness = try AppModelHarness()
        harness.model.acceptChallenge(token: harnessChallengeToken)
        await harness.model.resendCode()
        #expect(harness.service.calls.isEmpty)
    }
}
