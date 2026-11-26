import Foundation
import Testing
@testable import TodzKit

private let seededMinutes = 420
private let readMinutes = 480
private let savedMinutes = 450

extension AppModelTests {
    @MainActor private func harnessOfConfirmedOwner() async throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let issued = harness.service.issuedSession
        harness.service.issuedSession = IssuedSession(
            sessionToken: issued.sessionToken,
            owner: Owner(identifier: issued.owner.identifier, timeZone: issued.owner.timeZone, agentNudge: true, dayEmail: true, dayEmailMinutes: seededMinutes)
        )
        await harness.signedIn()
        return harness
    }

    @MainActor private func changeOwnerOnTheServer(_ harness: AppModelHarness, agentNudge: Bool, dayEmail: Bool, dayEmailMinutes: Int) {
        let issued = harness.service.issuedSession
        harness.service.issuedSession = IssuedSession(
            sessionToken: issued.sessionToken,
            owner: Owner(identifier: issued.owner.identifier, timeZone: issued.owner.timeZone, agentNudge: agentNudge, dayEmail: dayEmail, dayEmailMinutes: dayEmailMinutes)
        )
    }

    @MainActor private func readOwnerCount(_ harness: AppModelHarness) -> Int {
        harness.service.routes().filter { $0 == .readOwner }.count
    }

    @Test func refreshingTheOwnerSettingsTakesAllThreeValuesFromTheRead() async throws {
        let harness = try await harnessOfConfirmedOwner()
        changeOwnerOnTheServer(harness, agentNudge: false, dayEmail: false, dayEmailMinutes: readMinutes)
        await harness.model.refreshOwnerSettings()
        #expect(harness.model.agentNudge == false)
        #expect(harness.model.dayEmail == false)
        #expect(harness.model.dayEmailMinutes == readMinutes)
        #expect(harness.service.routes() == [.readOwner])
    }

    @Test func refreshingTheOwnerSettingsSignedOutMakesNoCall() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        await harness.model.refreshOwnerSettings()
        #expect(harness.service.calls == [])
        #expect(harness.model.agentNudge == nil)
        #expect(harness.model.dayEmail == nil)
        #expect(harness.model.dayEmailMinutes == nil)
    }

    @Test func refreshingTheOwnerSettingsBeforeTheOwnerIsConfirmedReadsNothing() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.vault.secret = harness.session
        harness.service.suspend(.updateOwner)
        let launching = Task { await harness.model.launch() }
        await harness.service.held(.updateOwner)
        await harness.model.refreshOwnerSettings()
        harness.service.unsuspend(.updateOwner)
        harness.service.resume(.updateOwner)
        await launching.value
        #expect(harness.service.routes().contains(.readOwner) == false)
    }

    @Test func aSecondRefreshWhileTheFirstReadIsHeldMakesNoSecondRead() async throws {
        let harness = try await harnessOfConfirmedOwner()
        harness.service.suspend(.readOwner)
        let refreshing = Task { await harness.model.refreshOwnerSettings() }
        await harness.service.held(.readOwner)
        let refreshingAgain = Task { await harness.model.refreshOwnerSettings() }
        await Task.yield()
        harness.service.unsuspend(.readOwner)
        harness.service.resume(.readOwner)
        harness.service.resume(.readOwner)
        await refreshing.value
        await refreshingAgain.value
        #expect(readOwnerCount(harness) == 1)
    }

    @Test func aNudgeSaveInFlightWhenTheReadStartsKeepsTheSavedValue() async throws {
        let harness = try await harnessOfConfirmedOwner()
        harness.service.suspend(.updateAgentNudge)
        let saving = Task { await harness.model.changeAgentNudge(isEnabled: false) }
        await harness.service.held(.updateAgentNudge)
        changeOwnerOnTheServer(harness, agentNudge: true, dayEmail: false, dayEmailMinutes: readMinutes)
        await harness.model.refreshOwnerSettings()
        #expect(harness.model.agentNudge == false)
        #expect(harness.model.dayEmail == false)
        #expect(harness.model.dayEmailMinutes == readMinutes)
        harness.service.unsuspend(.updateAgentNudge)
        harness.service.resume(.updateAgentNudge)
        await saving.value
        #expect(harness.model.agentNudge == false)
    }

    @Test func aDayEmailSaveThatStartsWhileTheReadIsHeldKeepsTheSavedValues() async throws {
        let harness = try await harnessOfConfirmedOwner()
        harness.service.suspend(.readOwner)
        let refreshing = Task { await harness.model.refreshOwnerSettings() }
        await harness.service.held(.readOwner)
        harness.service.suspend(.updateDayEmailMinutes)
        let saving = Task { await harness.model.changeDayEmail(minutes: savedMinutes) }
        await harness.service.held(.updateDayEmailMinutes)
        changeOwnerOnTheServer(harness, agentNudge: false, dayEmail: false, dayEmailMinutes: readMinutes)
        harness.service.unsuspend(.readOwner)
        harness.service.resume(.readOwner)
        await refreshing.value
        #expect(harness.model.dayEmail == true)
        #expect(harness.model.dayEmailMinutes == savedMinutes)
        #expect(harness.model.agentNudge == false)
        harness.service.unsuspend(.updateDayEmailMinutes)
        harness.service.resume(.updateDayEmailMinutes)
        await saving.value
        #expect(harness.model.dayEmailMinutes == savedMinutes)
    }

    @Test func aNudgeSaveThatFinishesWhileTheReadIsHeldKeepsTheSavedValue() async throws {
        let harness = try await harnessOfConfirmedOwner()
        harness.service.suspend(.readOwner)
        let refreshing = Task { await harness.model.refreshOwnerSettings() }
        await harness.service.held(.readOwner)
        await harness.model.changeAgentNudge(isEnabled: false)
        harness.service.unsuspend(.readOwner)
        harness.service.resume(.readOwner)
        await refreshing.value
        #expect(harness.model.agentNudge == false)
    }

    @Test func aDayEmailSaveThatFinishesWhileTheReadIsHeldKeepsTheSavedValue() async throws {
        let harness = try await harnessOfConfirmedOwner()
        harness.service.suspend(.readOwner)
        let refreshing = Task { await harness.model.refreshOwnerSettings() }
        await harness.service.held(.readOwner)
        await harness.model.changeDayEmail(isEnabled: false)
        changeOwnerOnTheServer(harness, agentNudge: true, dayEmail: true, dayEmailMinutes: readMinutes)
        harness.service.unsuspend(.readOwner)
        harness.service.resume(.readOwner)
        await refreshing.value
        #expect(harness.model.dayEmail == false)
    }

    @Test func aDayEmailSaveInFlightWhenTheReadStartsKeepsTheSavedValue() async throws {
        let harness = try await harnessOfConfirmedOwner()
        harness.service.suspend(.updateDayEmail)
        let saving = Task { await harness.model.changeDayEmail(isEnabled: false) }
        await harness.service.held(.updateDayEmail)
        changeOwnerOnTheServer(harness, agentNudge: false, dayEmail: true, dayEmailMinutes: readMinutes)
        await harness.model.refreshOwnerSettings()
        #expect(harness.model.dayEmail == false)
        #expect(harness.model.agentNudge == false)
        harness.service.unsuspend(.updateDayEmail)
        harness.service.resume(.updateDayEmail)
        await saving.value
        #expect(harness.model.dayEmail == false)
    }

    @Test func aReadThatCannotReachTodzKeepsEveryValueAndShowsNoNotSavedNotice() async throws {
        let harness = try await harnessOfConfirmedOwner()
        changeOwnerOnTheServer(harness, agentNudge: false, dayEmail: false, dayEmailMinutes: readMinutes)
        harness.service.failures[.readOwner] = .unreachable
        await harness.model.refreshOwnerSettings()
        #expect(harness.model.agentNudge == true)
        #expect(harness.model.dayEmail == true)
        #expect(harness.model.dayEmailMinutes == seededMinutes)
        #expect(harness.model.agentNudgeNotice != .notSaved)
        #expect(harness.model.dayEmailNotice != .notSaved)
    }

    @Test func anUnauthorizedReadEndsTheSession() async throws {
        let harness = try await harnessOfConfirmedOwner()
        harness.service.failures[.readOwner] = .unauthorized
        await harness.model.refreshOwnerSettings()
        #expect(harness.model.phase == .signedOut(notice: .sessionEnded))
    }

    @Test func aReadAnsweredAfterASignOutIsDropped() async throws {
        let harness = try await harnessOfConfirmedOwner()
        changeOwnerOnTheServer(harness, agentNudge: false, dayEmail: false, dayEmailMinutes: readMinutes)
        harness.service.suspend(.readOwner)
        let refreshing = Task { await harness.model.refreshOwnerSettings() }
        await harness.service.held(.readOwner)
        await harness.model.signOut()
        harness.service.unsuspend(.readOwner)
        harness.service.resume(.readOwner)
        await refreshing.value
        #expect(harness.model.agentNudge == nil)
        #expect(harness.model.dayEmail == nil)
        #expect(harness.model.dayEmailMinutes == nil)
    }
}
