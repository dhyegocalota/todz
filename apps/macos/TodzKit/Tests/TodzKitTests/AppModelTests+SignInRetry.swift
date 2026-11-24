import Foundation
import Testing
@testable import TodzKit

private let emailAddress = "maria@example.com"
private let linkToken = String(repeating: "aB3_-", count: 8) + "xyz"
private let pendingLifetime: TimeInterval = 20 * 60
private let firstVerifier = "verifier-1"

private func incomingLink() throws -> SignInLink {
    let url = try #require(URL(string: "todz://sign-in?token=\(linkToken)"))
    return try #require(SignInLink(url: url))
}

@MainActor private func harnessWithAPendingLink() throws -> AppModelHarness {
    let harness = try AppModelHarness()
    harness.pendingLinks.link = PendingSignInLink(email: emailAddress, verifier: firstVerifier, expiresAt: fixedInstant.addingTimeInterval(pendingLifetime))
    return harness
}

extension AppModelTests {
    @Test func anOfflineRedeemKeepsTheLinkAndTryAgainRedeemsItWithoutAskingForANewMail() async throws {
        let harness = try harnessWithAPendingLink()
        harness.seedWorkspace(name: "acme")
        await harness.model.launch()
        harness.service.failures[.signIn] = .unreachable
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.model.canRedeemAgain)
        harness.service.failures = [:]
        await harness.model.redeemHeldSignInLink()
        #expect(harness.service.routes().prefix(3) == [.signIn, .signIn, .listWorkspaces])
        #expect(harness.service.routes().contains(.requestSignInLink) == false)
        #expect(harness.model.phase == .ready)
        #expect(harness.model.canRedeemAgain == false)
        #expect(harness.model.signInError == nil)
    }

    @Test func aRedeemThatFailsAgainOfflineKeepsTheLinkForTheNextTryAgain() async throws {
        let harness = try harnessWithAPendingLink()
        await harness.model.launch()
        harness.service.failures[.signIn] = .unreachable
        await harness.model.redeem(signInLink: try incomingLink())
        await harness.model.redeemHeldSignInLink()
        #expect(harness.model.canRedeemAgain)
        #expect(harness.model.signInError == .unreachable)
    }

    @Test(arguments: [OwnerAPIError.identityRejected, .timeZoneInvalid, .unexpected(status: 500)])
    func aRedeemThatFailsForAnotherReasonKeepsNoLinkToRedeemAgain(failure: OwnerAPIError) async throws {
        let harness = try harnessWithAPendingLink()
        await harness.model.launch()
        harness.service.failures[.signIn] = failure
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.model.canRedeemAgain == false)
    }

    @Test func sendingAnotherMailLetsGoOfTheHeldLink() async throws {
        let harness = try harnessWithAPendingLink()
        await harness.model.launch()
        harness.service.failures[.signIn] = .unreachable
        await harness.model.redeem(signInLink: try incomingLink())
        harness.service.failures = [:]
        await harness.model.requestSignInLink(email: emailAddress)
        #expect(harness.model.canRedeemAgain == false)
    }

    @Test func usingADifferentEmailLetsGoOfTheHeldLinkAndTheError() async throws {
        let harness = try harnessWithAPendingLink()
        await harness.model.launch()
        harness.service.failures[.signIn] = .unreachable
        await harness.model.redeem(signInLink: try incomingLink())
        harness.model.useDifferentEmail()
        #expect(harness.model.canRedeemAgain == false)
        #expect(harness.model.pendingLink == nil)
        #expect(harness.pendingLinks.link == nil)
        #expect(harness.model.signInError == nil)
    }

    @Test func usingADifferentEmailClearsTheErrorLine() async throws {
        let harness = try AppModelHarness()
        await harness.model.requestSignInLink(email: emailAddress)
        harness.service.failures[.requestSignInLink] = .tooManyLinks
        await harness.model.requestSignInLink(email: emailAddress)
        #expect(harness.model.signInError == .tooManyLinks)
        harness.model.useDifferentEmail()
        #expect(harness.model.signInError == nil)
        #expect(harness.model.pendingLink == nil)
    }

    @Test(arguments: ["MARIA@example.com", " maria@Example.com ", "Maria@EXAMPLE.COM"])
    func sendingAgainReusesTheVerifierWhateverTheCaseAndPaddingOfTheAddress(typed: String) async throws {
        let harness = try AppModelHarness()
        await harness.model.requestSignInLink(email: emailAddress)
        await harness.model.requestSignInLink(email: typed)
        #expect(harness.verifiers.issued == [firstVerifier])
        #expect(harness.model.pendingLink?.verifier == firstVerifier)
    }

    @Test func loadingTheMethodKeepsTheErrorOfARedeemThatFailedMeanwhile() async throws {
        let harness = try harnessWithAPendingLink()
        await harness.model.launch()
        harness.service.failures[.signIn] = .identityRejected
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.model.signInError == .linkRejected)
        await harness.model.loadSignInMethod()
        #expect(harness.model.signInError == .linkRejected)
        #expect(harness.model.signInMethodError == nil)
    }

    @Test func aMethodReadThatFailsLeavesTheRedeemErrorAloneAndSaysWhy() async throws {
        let harness = try harnessWithAPendingLink()
        await harness.model.launch()
        harness.service.failures[.signIn] = .identityRejected
        await harness.model.redeem(signInLink: try incomingLink())
        harness.service.failures[.signInMethod] = .unreachable
        await harness.model.loadSignInMethod()
        #expect(harness.model.signInError == .linkRejected)
        #expect(harness.model.signInMethodError == .unreachable)
    }

    @Test func aMethodReadThatSucceedsAfterAFailureClearsTheMethodError() async throws {
        let harness = try AppModelHarness()
        harness.service.failures[.signInMethod] = .unreachable
        await harness.model.loadSignInMethod()
        harness.service.failures = [:]
        await harness.model.loadSignInMethod()
        #expect(harness.model.signInMethodError == nil)
        #expect(harness.model.signInMethod == .identity)
    }

    @Test func aSignInByIdentityErasesAnyPendingLink() async throws {
        let harness = try harnessWithAPendingLink()
        harness.seedWorkspace(name: "acme")
        await harness.model.launch()
        await harness.model.signIn(identity: "walker-2")
        #expect(harness.model.phase == .ready)
        #expect(harness.model.pendingLink == nil)
        #expect(harness.pendingLinks.link == nil)
    }

    @Test func aFailedSignInByIdentityKeepsThePendingLink() async throws {
        let harness = try harnessWithAPendingLink()
        await harness.model.launch()
        harness.service.failures[.signIn] = .identityRejected
        await harness.model.signIn(identity: "walker-2")
        #expect(harness.model.pendingLink?.verifier == firstVerifier)
        #expect(harness.pendingLinks.link?.verifier == firstVerifier)
    }

    @Test func anInvalidAddressAnswerOnAskingShowsTheAddressHintAndKeepsNoPendingLink() async throws {
        let harness = try AppModelHarness()
        harness.service.failures[.requestSignInLink] = .invalidRequest
        await harness.model.requestSignInLink(email: emailAddress)
        #expect(harness.model.signInError == .invalidAddress)
        #expect(harness.model.pendingLink == nil)
    }

    @Test func anInvalidRequestAnswerOnRedeemingStaysUnexpected() async throws {
        let harness = try harnessWithAPendingLink()
        await harness.model.launch()
        harness.service.failures[.signIn] = .invalidRequest
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.model.signInError == .unexpected)
    }
}
