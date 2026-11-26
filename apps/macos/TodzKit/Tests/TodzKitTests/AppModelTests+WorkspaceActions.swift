import Foundation
import Testing
@testable import TodzKit

extension AppModelTests {
    @Test func theNextActionSwitchesToTheFollowingWorkspaceAndWraps() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        let side = harness.seedWorkspace(name: "side", projectNames: ["garden"])
        harness.rememberWorkspace(identifier: "acme")
        await harness.signedIn()
        await harness.model.switchWorkspace(action: .next)
        #expect(harness.model.activeWorkspace == side)
        await harness.model.switchWorkspace(action: .next)
        #expect(harness.model.activeWorkspace == acme)
    }

    @Test func aNumberActionPastTheListChangesNothing() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        harness.seedWorkspace(name: "side", projectNames: ["garden"])
        harness.rememberWorkspace(identifier: "acme")
        await harness.signedIn()
        await harness.model.switchWorkspace(action: .number(3))
        #expect(harness.model.activeWorkspace == acme)
    }
}
