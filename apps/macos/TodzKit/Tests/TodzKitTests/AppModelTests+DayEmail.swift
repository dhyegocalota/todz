import Foundation
import Testing
@testable import TodzKit

private let failedSaves: [OwnerAPIError] = [.invalidRequest, .unexpected(status: 503), .unreachable]
private let seededMinutes = 420
private let changedMinutes = 450

extension AppModelTests {
    @MainActor private func harnessOfOwner(dayEmail: Bool) throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let issued = harness.service.issuedSession
        harness.service.issuedSession = IssuedSession(
            sessionToken: issued.sessionToken,
            owner: Owner(identifier: issued.owner.identifier, timeZone: issued.owner.timeZone, dayEmail: dayEmail, dayEmailMinutes: seededMinutes)
        )
        return harness
    }

    @Test func signedOutTheDayEmailIsUnknownAndCannotBeChanged() async throws {
        let harness = try harnessOfOwner(dayEmail: true)
        await harness.model.launch()
        #expect(harness.model.dayEmail == nil)
        #expect(harness.model.dayEmailMinutes == nil)
        #expect(harness.model.canChangeDayEmail == false)
        #expect(harness.model.dayEmailNotice == .signedOut)
        await harness.model.changeDayEmail(isEnabled: true)
        await harness.model.changeDayEmail(minutes: changedMinutes)
        #expect(harness.service.calls == [])
    }

    @Test func beforeTheOwnerIsConfirmedTheDayEmailIsUnknownAndCannotBeChanged() async throws {
        let harness = try harnessOfOwner(dayEmail: true)
        harness.vault.secret = harness.session
        harness.service.suspend(.updateOwner)
        let launching = Task { await harness.model.launch() }
        await harness.service.held(.updateOwner)
        #expect(harness.model.dayEmail == nil)
        #expect(harness.model.canChangeDayEmail == false)
        #expect(harness.model.dayEmailNotice == .detail)
        await harness.model.changeDayEmail(isEnabled: false)
        harness.service.unsuspend(.updateOwner)
        harness.service.resume(.updateOwner)
        await launching.value
        #expect(harness.service.routes().contains(.updateDayEmail) == false)
        #expect(harness.model.dayEmail == true)
        #expect(harness.model.dayEmailMinutes == seededMinutes)
    }

    @Test func aSignInReadsTheDayEmailOfTheIssuedOwner() async throws {
        let harness = try harnessOfOwner(dayEmail: true)
        await harness.model.launch()
        await harness.model.signIn(identity: "dhyego")
        #expect(harness.model.dayEmail == true)
        #expect(harness.model.dayEmailMinutes == seededMinutes)
        #expect(harness.model.canChangeDayEmail)
    }

    @Test func confirmingTheOwnerReadsTheDayEmailFromTheTimeZoneAnswer() async throws {
        let harness = try harnessOfOwner(dayEmail: true)
        await harness.signedIn()
        #expect(harness.model.dayEmail == true)
        #expect(harness.model.dayEmailMinutes == seededMinutes)
        #expect(harness.model.canChangeDayEmail)
        #expect(harness.model.dayEmailNotice == .detail)
    }

    @Test func confirmingTheOwnerByReadingItReadsTheDayEmail() async throws {
        let harness = try harnessOfOwner(dayEmail: true)
        harness.service.failures[.updateOwner] = .timeZoneInvalid
        await harness.signedIn()
        #expect(harness.model.dayEmail == true)
        #expect(harness.model.dayEmailMinutes == seededMinutes)
        #expect(harness.model.canChangeDayEmail)
    }

    @Test func aLaunchThatCannotReachTodzLeavesTheDayEmailUnknownAndSaysSo() async throws {
        let harness = try harnessOfOwner(dayEmail: true)
        harness.service.failures[.updateOwner] = .unreachable
        harness.service.failures[.listWorkspaces] = .unreachable
        await harness.signedIn()
        #expect(harness.model.dayEmail == nil)
        #expect(harness.model.canChangeDayEmail == false)
        #expect(harness.model.dayEmailNotice == .offline)
    }

    @Test func turningTheDayEmailOnSavesItOnceAndHoldsTheAnswer() async throws {
        let harness = try harnessOfOwner(dayEmail: false)
        await harness.signedIn()
        await harness.model.changeDayEmail(isEnabled: true)
        #expect(harness.service.calls == [.updateDayEmail(session: harness.session, isEnabled: true)])
        #expect(harness.model.dayEmail == true)
        #expect(harness.model.dayEmailMinutes == seededMinutes)
        #expect(harness.model.canChangeDayEmail)
        #expect(harness.model.dayEmailNotice == .detail)
    }

    @Test func changingTheTimeSavesItOnceAndHoldsTheAnswer() async throws {
        let harness = try harnessOfOwner(dayEmail: true)
        await harness.signedIn()
        await harness.model.changeDayEmail(minutes: changedMinutes)
        #expect(harness.service.calls == [.updateDayEmailMinutes(session: harness.session, minutes: changedMinutes)])
        #expect(harness.model.dayEmail == true)
        #expect(harness.model.dayEmailMinutes == changedMinutes)
        #expect(harness.model.canChangeDayEmail)
    }

    @Test func whileASaveIsHeldTheDayEmailShowsTheNewValueAndASecondChangeMakesNoCall() async throws {
        let harness = try harnessOfOwner(dayEmail: false)
        await harness.signedIn()
        harness.service.suspend(.updateDayEmail)
        let saving = Task { await harness.model.changeDayEmail(isEnabled: true) }
        await harness.service.held(.updateDayEmail)
        #expect(harness.model.dayEmail == true)
        #expect(harness.model.canChangeDayEmail == false)
        await harness.model.changeDayEmail(isEnabled: false)
        await harness.model.changeDayEmail(minutes: changedMinutes)
        harness.service.unsuspend(.updateDayEmail)
        harness.service.resume(.updateDayEmail)
        await saving.value
        #expect(harness.service.routes() == [.updateDayEmail])
        #expect(harness.model.dayEmail == true)
        #expect(harness.model.dayEmailMinutes == seededMinutes)
        #expect(harness.model.canChangeDayEmail)
    }

    @Test func whileATimeSaveIsHeldTheDayEmailShowsTheNewTimeAndCannotBeChanged() async throws {
        let harness = try harnessOfOwner(dayEmail: true)
        await harness.signedIn()
        harness.service.suspend(.updateDayEmailMinutes)
        let saving = Task { await harness.model.changeDayEmail(minutes: changedMinutes) }
        await harness.service.held(.updateDayEmailMinutes)
        #expect(harness.model.dayEmailMinutes == changedMinutes)
        #expect(harness.model.canChangeDayEmail == false)
        harness.service.unsuspend(.updateDayEmailMinutes)
        harness.service.resume(.updateDayEmailMinutes)
        await saving.value
        #expect(harness.model.canChangeDayEmail)
    }

    @Test(arguments: failedSaves)
    func aFailedSaveRevertsBothValuesAndSaysSo(failure: OwnerAPIError) async throws {
        let harness = try harnessOfOwner(dayEmail: false)
        await harness.signedIn()
        harness.service.failures[.updateDayEmailMinutes] = failure
        await harness.model.changeDayEmail(minutes: changedMinutes)
        #expect(harness.model.dayEmail == false)
        #expect(harness.model.dayEmailMinutes == seededMinutes)
        #expect(harness.model.isSavingDayEmail == false)
        #expect(harness.model.dayEmailNotice == .notSaved)
    }

    @Test(arguments: failedSaves)
    func aFailedSaveLeavesTheDayEmailChangeableSoTheNextChangeTriesAgain(failure: OwnerAPIError) async throws {
        let harness = try harnessOfOwner(dayEmail: false)
        await harness.signedIn()
        harness.service.failures[.updateDayEmail] = failure
        await harness.model.changeDayEmail(isEnabled: true)
        #expect(harness.model.dayEmail == false)
        #expect(harness.model.canChangeDayEmail)
        harness.service.failures = [:]
        harness.service.calls = []
        await harness.model.changeDayEmail(isEnabled: true)
        #expect(harness.service.routes() == [.updateDayEmail])
        #expect(harness.model.dayEmail == true)
        #expect(harness.model.dayEmailNotice == .detail)
    }

    @Test func forgettingTheFailedDayEmailSaveShowsTheDetailAgain() async throws {
        let harness = try harnessOfOwner(dayEmail: false)
        await harness.signedIn()
        harness.service.failures[.updateDayEmail] = .invalidRequest
        await harness.model.changeDayEmail(isEnabled: true)
        harness.model.forgetDayEmailFailure()
        #expect(harness.model.dayEmailNotice == .detail)
        #expect(harness.model.dayEmail == false)
    }

    @Test func offlineTheDayEmailKeepsItsLastValuesAndCannotBeChanged() async throws {
        let harness = try harnessOfOwner(dayEmail: true)
        await harness.signedIn()
        harness.service.failures[.readChanges] = .unreachable
        await harness.model.refresh()
        harness.service.calls = []
        #expect(harness.model.dayEmail == true)
        #expect(harness.model.dayEmailMinutes == seededMinutes)
        #expect(harness.model.canChangeDayEmail == false)
        #expect(harness.model.dayEmailNotice == .offline)
        await harness.model.changeDayEmail(isEnabled: false)
        await harness.model.changeDayEmail(minutes: changedMinutes)
        #expect(harness.service.calls == [])
        #expect(harness.model.dayEmail == true)
    }

    @Test func aSignOutClearsTheDayEmail() async throws {
        let harness = try harnessOfOwner(dayEmail: true)
        await harness.signedIn()
        await harness.model.signOut()
        #expect(harness.model.dayEmail == nil)
        #expect(harness.model.dayEmailMinutes == nil)
        #expect(harness.model.canChangeDayEmail == false)
        #expect(harness.model.dayEmailNotice == .signedOut)
    }

    @Test func aDayEmailSaveAnsweredAfterASignOutIsDropped() async throws {
        let harness = try harnessOfOwner(dayEmail: false)
        await harness.signedIn()
        harness.service.suspend(.updateDayEmail)
        let saving = Task { await harness.model.changeDayEmail(isEnabled: true) }
        await harness.service.held(.updateDayEmail)
        await harness.model.signOut()
        harness.service.unsuspend(.updateDayEmail)
        harness.service.resume(.updateDayEmail)
        await saving.value
        #expect(harness.model.dayEmail == nil)
        #expect(harness.model.dayEmailMinutes == nil)
        #expect(harness.model.isSavingDayEmail == false)
        #expect(harness.model.dayEmailNotice == .signedOut)
    }
}
