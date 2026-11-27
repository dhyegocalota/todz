import Foundation
import Testing
@testable import TodzKit

private let olderApp = ConnectedAppFixtures.connectedApp(identifier: "app-older", createdAtMilliseconds: OwnerFixtures.createdAtMilliseconds)
private let newerApp = ConnectedAppFixtures.connectedApp(identifier: "app-newer", createdAtMilliseconds: OwnerFixtures.updatedAtMilliseconds)

@MainActor private func connectedAppHarness() async throws -> AppModelHarness {
    let harness = try AppModelHarness()
    harness.seedWorkspace(name: "acme")
    harness.service.connectedApps = [olderApp, newerApp]
    await harness.signedIn()
    return harness
}

extension AppModelTests {
    @Test func loadingTheConnectedAppsListsThemNewestFirst() async throws {
        let harness = try await connectedAppHarness()
        await harness.model.loadConnectedApps()
        #expect(harness.model.connectedApps == .loaded([newerApp, olderApp]))
        #expect(harness.service.calls == [.listConnectedApps(session: harness.session)])
    }

    @Test func aFailedFirstLoadOfTheConnectedAppsIsShownAsFailed() async throws {
        let harness = try await connectedAppHarness()
        harness.service.failures[.listConnectedApps] = .unreachable
        await harness.model.loadConnectedApps()
        #expect(harness.model.connectedApps == .failed(.unreachable))
    }

    @Test func aFailedReloadKeepsTheShownConnectedApps() async throws {
        let harness = try await connectedAppHarness()
        await harness.model.loadConnectedApps()
        harness.service.failures[.listConnectedApps] = .unreachable
        await harness.model.loadConnectedApps()
        #expect(harness.model.connectedApps == .loaded([newerApp, olderApp]))
    }

    @Test func disconnectingAnAppRemovesItFromTheList() async throws {
        let harness = try await connectedAppHarness()
        await harness.model.loadConnectedApps()
        await harness.model.disconnectConnectedApp(olderApp)
        #expect(harness.model.connectedApps == .loaded([newerApp]))
        #expect(harness.model.connectedAppFailure == nil)
        #expect(harness.model.isChangingConnectedApps == false)
        #expect(harness.service.calls.contains(.disconnectConnectedApp(session: harness.session, connectedAppIdentifier: olderApp.identifier)))
    }

    @Test func disconnectingAnAppTheServerNoLongerHasStillRemovesIt() async throws {
        let harness = try await connectedAppHarness()
        await harness.model.loadConnectedApps()
        harness.service.connectedApps = [newerApp]
        await harness.model.disconnectConnectedApp(olderApp)
        #expect(harness.model.connectedApps == .loaded([newerApp]))
        #expect(harness.model.connectedAppFailure == nil)
    }

    @Test func aFailedDisconnectKeepsTheAppAndSaysSo() async throws {
        let harness = try await connectedAppHarness()
        await harness.model.loadConnectedApps()
        harness.service.failures[.disconnectConnectedApp] = .unreachable
        await harness.model.disconnectConnectedApp(olderApp)
        #expect(harness.model.connectedApps == .loaded([newerApp, olderApp]))
        #expect(harness.model.connectedAppFailure == .notDisconnected)
    }

    @Test func aNewDisconnectClearsTheLastFailure() async throws {
        let harness = try await connectedAppHarness()
        await harness.model.loadConnectedApps()
        harness.service.failures[.disconnectConnectedApp] = .unreachable
        await harness.model.disconnectConnectedApp(olderApp)
        harness.service.failures[.disconnectConnectedApp] = nil
        await harness.model.disconnectConnectedApp(olderApp)
        #expect(harness.model.connectedAppFailure == nil)
    }

    @Test func leavingTheWindowForgetsTheConnectedApps() async throws {
        let harness = try await connectedAppHarness()
        await harness.model.loadConnectedApps()
        harness.model.forgetWindow()
        #expect(harness.model.connectedApps == nil)
        #expect(harness.model.connectedAppFailure == nil)
    }

    @Test func aConnectedAppsAnswerAfterSettingsClosedIsIgnored() async throws {
        let harness = try await connectedAppHarness()
        harness.service.suspend(.listConnectedApps)
        let loading = Task { await harness.model.loadConnectedApps() }
        await harness.service.held(.listConnectedApps)
        harness.model.forgetConnectedApps()
        harness.service.resume(.listConnectedApps)
        await loading.value
        #expect(harness.model.connectedApps == nil)
    }
}
