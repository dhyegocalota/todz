import Foundation
import Testing
@testable import TodzKit

private let emailAddress = "maria@example.com"
private let linkToken = String(repeating: "aB3_-", count: 8) + "xyz"
private let pendingLifetime: TimeInterval = 20 * 60

private func incomingLink() throws -> SignInLink {
    let url = try #require(URL(string: "todz://sign-in?token=\(linkToken)"))
    return try #require(SignInLink(url: url))
}

@MainActor private func harnessWithAPendingLink() throws -> AppModelHarness {
    let harness = try AppModelHarness()
    harness.service.signInMethodAnswer = .link
    harness.pendingLinks.link = PendingSignInLink(email: emailAddress, verifier: "verifier-0", expiresAt: fixedInstant.addingTimeInterval(pendingLifetime))
    return harness
}

@MainActor @Suite struct SignInStageTests {
    @Test func beforeTheMethodIsKnownItIsLoading() throws {
        let harness = try AppModelHarness()
        #expect(SignInStage(model: harness.model) == .methodLoading)
    }

    @Test func aMethodThatCannotBeReadIsUnavailable() async throws {
        let harness = try AppModelHarness()
        harness.service.failures[.signInMethod] = .unreachable
        await harness.model.loadSignInMethod()
        #expect(SignInStage(model: harness.model) == .methodUnavailable)
    }

    @Test func theIdentityMethodShowsTheIdentityStage() async throws {
        let harness = try AppModelHarness()
        harness.service.signInMethodAnswer = .identity
        await harness.model.loadSignInMethod()
        #expect(SignInStage(model: harness.model) == .identity)
    }

    @Test func theLinkMethodWithNoPendingLinkShowsTheAddress() async throws {
        let harness = try AppModelHarness()
        harness.service.signInMethodAnswer = .link
        await harness.model.loadSignInMethod()
        #expect(SignInStage(model: harness.model) == .address)
    }

    @Test func theFirstAskShowsSendingWhileItIsInFlight() async throws {
        let harness = try AppModelHarness()
        harness.service.signInMethodAnswer = .link
        await harness.model.loadSignInMethod()
        harness.service.suspend(.requestSignInLink)
        let asking = Task { await harness.model.requestSignInLink(email: emailAddress) }
        await harness.service.held(.requestSignInLink)
        #expect(SignInStage(model: harness.model) == .sending)
        harness.service.unsuspend(.requestSignInLink)
        harness.service.resume(.requestSignInLink)
        await asking.value
        #expect(SignInStage(model: harness.model) == .awaitingLink)
    }

    @Test func aPendingLinkShowsTheInbox() async throws {
        let harness = try harnessWithAPendingLink()
        await harness.model.launch()
        await harness.model.loadSignInMethod()
        #expect(SignInStage(model: harness.model) == .awaitingLink)
    }

    @Test func aRedeemInFlightShowsRedeemingEvenBeforeTheMethodIsKnown() async throws {
        let harness = try harnessWithAPendingLink()
        await harness.model.launch()
        harness.service.suspend(.signIn)
        let link = try incomingLink()
        let redeeming = Task { await harness.model.redeem(signInLink: link) }
        await harness.service.held(.signIn)
        #expect(harness.model.signInMethod == nil)
        #expect(SignInStage(model: harness.model) == .redeeming)
        harness.service.unsuspend(.signIn)
        harness.service.resume(.signIn)
        await redeeming.value
    }

    @Test func aRedeemInFlightShowsRedeemingOnceTheMethodIsKnown() async throws {
        let harness = try harnessWithAPendingLink()
        await harness.model.launch()
        await harness.model.loadSignInMethod()
        harness.service.suspend(.signIn)
        let link = try incomingLink()
        let redeeming = Task { await harness.model.redeem(signInLink: link) }
        await harness.service.held(.signIn)
        #expect(SignInStage(model: harness.model) == .redeeming)
        harness.service.unsuspend(.signIn)
        harness.service.resume(.signIn)
        await redeeming.value
    }

    @Test(arguments: [OwnerAPIError.identityRejected, .timeZoneInvalid])
    func aRefusedLinkSendsTheOwnerBackToTheAddress(failure: OwnerAPIError) async throws {
        let harness = try harnessWithAPendingLink()
        await harness.model.launch()
        await harness.model.loadSignInMethod()
        harness.service.failures[.signIn] = failure
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.model.pendingLink != nil)
        #expect(SignInStage(model: harness.model) == .address)
    }

    @Test func aLinkWithNoPendingRequestSendsTheOwnerToTheAddress() async throws {
        let harness = try AppModelHarness()
        harness.service.signInMethodAnswer = .link
        await harness.model.launch()
        await harness.model.loadSignInMethod()
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(harness.model.signInError == .linkNotRequested)
        #expect(SignInStage(model: harness.model) == .address)
    }

    @Test func anOfflineRedeemKeepsTheInboxWithTheError() async throws {
        let harness = try harnessWithAPendingLink()
        await harness.model.launch()
        await harness.model.loadSignInMethod()
        harness.service.failures[.signIn] = .unreachable
        await harness.model.redeem(signInLink: try incomingLink())
        #expect(SignInStage(model: harness.model) == .awaitingLink)
    }
}
