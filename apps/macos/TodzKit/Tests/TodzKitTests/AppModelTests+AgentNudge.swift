import Foundation
import Testing
@testable import TodzKit

private let failedSaves: [OwnerAPIError] = [.invalidRequest, .unexpected(status: 503), .unreachable]

extension AppModelTests {
    @MainActor private func harnessOfOwner(agentNudge: Bool) throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let issued = harness.service.issuedSession
        harness.service.issuedSession = IssuedSession(
            sessionToken: issued.sessionToken,
            owner: Owner(identifier: issued.owner.identifier, timeZone: issued.owner.timeZone, agentNudge: agentNudge)
        )
        return harness
    }

    @Test func signedOutTheAgentNudgeIsUnknownAndCannotBeChanged() async throws {
        let harness = try harnessOfOwner(agentNudge: true)
        await harness.model.launch()
        #expect(harness.model.agentNudge == nil)
        #expect(harness.model.canChangeAgentNudge == false)
        #expect(harness.model.agentNudgeNotice == .signedOut)
        await harness.model.changeAgentNudge(isEnabled: true)
        #expect(harness.service.calls == [])
    }

    @Test func beforeTheOwnerIsConfirmedTheAgentNudgeIsUnknownAndCannotBeChanged() async throws {
        let harness = try harnessOfOwner(agentNudge: true)
        harness.vault.secret = harness.session
        harness.service.suspend(.updateOwner)
        let launching = Task { await harness.model.launch() }
        await harness.service.held(.updateOwner)
        #expect(harness.model.agentNudge == nil)
        #expect(harness.model.canChangeAgentNudge == false)
        #expect(harness.model.agentNudgeNotice == .detail)
        await harness.model.changeAgentNudge(isEnabled: false)
        harness.service.unsuspend(.updateOwner)
        harness.service.resume(.updateOwner)
        await launching.value
        #expect(harness.service.routes().contains(.updateAgentNudge) == false)
        #expect(harness.model.agentNudge == true)
    }

    @Test func aSignInReadsTheAgentNudgeOfTheIssuedOwner() async throws {
        let harness = try harnessOfOwner(agentNudge: true)
        await harness.model.launch()
        await harness.model.signIn(identity: "dhyego")
        #expect(harness.model.agentNudge == true)
        #expect(harness.service.routes().contains(.updateOwner) == false)
        #expect(harness.model.canChangeAgentNudge)
    }

    @Test func confirmingTheOwnerReadsTheAgentNudgeFromTheTimeZoneAnswer() async throws {
        let harness = try harnessOfOwner(agentNudge: true)
        await harness.signedIn()
        #expect(harness.model.agentNudge == true)
        #expect(harness.model.canChangeAgentNudge)
        #expect(harness.model.agentNudgeNotice == .detail)
    }

    @Test func confirmingTheOwnerByReadingItReadsTheAgentNudge() async throws {
        let harness = try harnessOfOwner(agentNudge: true)
        harness.service.failures[.updateOwner] = .timeZoneInvalid
        await harness.signedIn()
        #expect(harness.model.agentNudge == true)
        #expect(harness.model.canChangeAgentNudge)
    }

    @Test func aLaunchThatCannotReachTodzLeavesTheAgentNudgeUnknownAndSaysSo() async throws {
        let harness = try harnessOfOwner(agentNudge: true)
        harness.service.failures[.updateOwner] = .unreachable
        await harness.signedIn()
        #expect(harness.model.agentNudge == nil)
        #expect(harness.model.canChangeAgentNudge == false)
        #expect(harness.model.agentNudgeNotice == .offline)
    }

    @Test func turningTheAgentNudgeOnSavesItOnceAndHoldsTheAnswer() async throws {
        let harness = try harnessOfOwner(agentNudge: false)
        await harness.signedIn()
        await harness.model.changeAgentNudge(isEnabled: true)
        #expect(harness.service.calls == [.updateAgentNudge(session: harness.session, isEnabled: true)])
        #expect(harness.model.agentNudge == true)
        #expect(harness.model.canChangeAgentNudge)
        #expect(harness.model.agentNudgeNotice == .detail)
    }

    @Test func whileASaveIsHeldTheAgentNudgeShowsTheNewValueAndASecondChangeMakesNoCall() async throws {
        let harness = try harnessOfOwner(agentNudge: false)
        await harness.signedIn()
        harness.service.suspend(.updateAgentNudge)
        let saving = Task { await harness.model.changeAgentNudge(isEnabled: true) }
        await harness.service.held(.updateAgentNudge)
        #expect(harness.model.agentNudge == true)
        #expect(harness.model.canChangeAgentNudge == false)
        await harness.model.changeAgentNudge(isEnabled: false)
        harness.service.unsuspend(.updateAgentNudge)
        harness.service.resume(.updateAgentNudge)
        await saving.value
        #expect(harness.service.routes() == [.updateAgentNudge])
        #expect(harness.model.agentNudge == true)
        #expect(harness.model.canChangeAgentNudge)
    }

    @Test(arguments: failedSaves)
    func aFailedSaveRevertsTheAgentNudgeAndSaysSo(failure: OwnerAPIError) async throws {
        let harness = try harnessOfOwner(agentNudge: false)
        await harness.signedIn()
        harness.service.failures[.updateAgentNudge] = failure
        await harness.model.changeAgentNudge(isEnabled: true)
        #expect(harness.model.agentNudge == false)
        #expect(harness.model.isSavingAgentNudge == false)
        #expect(harness.model.agentNudgeNotice == .notSaved)
    }

    @Test func aRefusedSaveCanBeTriedAgainAndTheNextChangeForgetsTheFailure() async throws {
        let harness = try harnessOfOwner(agentNudge: false)
        await harness.signedIn()
        harness.service.failures[.updateAgentNudge] = .invalidRequest
        await harness.model.changeAgentNudge(isEnabled: true)
        #expect(harness.model.canChangeAgentNudge)
        harness.service.failures = [:]
        await harness.model.changeAgentNudge(isEnabled: true)
        #expect(harness.model.agentNudge == true)
        #expect(harness.model.agentNudgeNotice == .detail)
    }

    @Test func forgettingTheFailedSaveShowsTheDetailAgain() async throws {
        let harness = try harnessOfOwner(agentNudge: false)
        await harness.signedIn()
        harness.service.failures[.updateAgentNudge] = .invalidRequest
        await harness.model.changeAgentNudge(isEnabled: true)
        harness.model.forgetAgentNudgeFailure()
        #expect(harness.model.agentNudgeNotice == .detail)
        #expect(harness.model.agentNudge == false)
    }

    @Test func offlineTheAgentNudgeKeepsItsLastValueAndCannotBeChanged() async throws {
        let harness = try harnessOfOwner(agentNudge: true)
        await harness.signedIn()
        harness.service.failures[.readChanges] = .unreachable
        await harness.model.refresh()
        harness.service.calls = []
        #expect(harness.model.agentNudge == true)
        #expect(harness.model.canChangeAgentNudge == false)
        #expect(harness.model.agentNudgeNotice == .offline)
        await harness.model.changeAgentNudge(isEnabled: false)
        #expect(harness.service.calls == [])
        #expect(harness.model.agentNudge == true)
    }

    @Test func aSignOutClearsTheAgentNudge() async throws {
        let harness = try harnessOfOwner(agentNudge: true)
        await harness.signedIn()
        await harness.model.signOut()
        #expect(harness.model.agentNudge == nil)
        #expect(harness.model.canChangeAgentNudge == false)
        #expect(harness.model.agentNudgeNotice == .signedOut)
    }

    @Test func aSaveAnsweredAfterASignOutIsDropped() async throws {
        let harness = try harnessOfOwner(agentNudge: false)
        await harness.signedIn()
        harness.service.suspend(.updateAgentNudge)
        let saving = Task { await harness.model.changeAgentNudge(isEnabled: true) }
        await harness.service.held(.updateAgentNudge)
        await harness.model.signOut()
        harness.service.unsuspend(.updateAgentNudge)
        harness.service.resume(.updateAgentNudge)
        await saving.value
        #expect(harness.model.agentNudge == nil)
        #expect(harness.model.isSavingAgentNudge == false)
        #expect(harness.model.agentNudgeNotice == .signedOut)
    }
}
