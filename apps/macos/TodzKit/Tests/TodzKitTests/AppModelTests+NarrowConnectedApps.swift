import Foundation
import Testing
@testable import TodzKit

private let grant = ConnectedAppFixtures.ownerScoped(identifier: "grant-1")
private let narrower: [ConnectedScope] = [.workspace(identifier: "acme", name: "acme")]

extension AppModelTests {
    @Test func narrowingAGrantSendsTheKeptScopesAndReloadsTheList() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.service.connectedApps = [grant]
        await harness.signedIn()
        await harness.model.loadConnectedApps()
        harness.service.calls = []
        await harness.model.narrowConnectedApp(grant, to: narrower)
        #expect(harness.service.calls == [.narrowConnectedApp(session: harness.session, connectedAppIdentifier: "grant-1", scopes: narrower), .listConnectedApps(session: harness.session)])
        #expect(harness.model.visibleConnectedApps.first?.scopes == narrower)
        #expect(harness.model.connectedAppFailure == nil)
    }

    @Test func aRefusedNarrowingIsToldAndTheListStaysAsItWas() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.service.connectedApps = [grant]
        await harness.signedIn()
        await harness.model.loadConnectedApps()
        harness.service.failures[.narrowConnectedApp] = .scopeNotNarrower
        await harness.model.narrowConnectedApp(grant, to: narrower)
        #expect(harness.model.connectedAppFailure == .notNarrowed)
        #expect(harness.model.visibleConnectedApps.first?.scopes == [.account])
    }

    @Test func narrowingToNothingSendsNothingBecauseRevokingIsTheWayToRemoveAll() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.service.connectedApps = [grant]
        await harness.signedIn()
        await harness.model.loadConnectedApps()
        harness.service.calls = []
        await harness.model.narrowConnectedApp(grant, to: [])
        #expect(harness.service.calls.isEmpty)
    }
}
