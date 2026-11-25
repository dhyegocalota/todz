import Testing
@testable import TodzKit

@Suite struct LaunchActivationTests {
    @Test func aDefaultLaunchWaitsForTheFirstWindowEvent() {
        #expect(LaunchActivation.of(isDefaultLaunch: true) == .afterTheFirstWindowEvent)
    }

    @Test func aLaunchThatIsNotTheDefaultAppliesAtLaunch() {
        #expect(LaunchActivation.of(isDefaultLaunch: false) == .atLaunch)
    }

    @Test func aLaunchThatDoesNotSayWaitsForTheFirstWindowEvent() {
        #expect(LaunchActivation.of(isDefaultLaunch: nil) == .afterTheFirstWindowEvent)
    }
}
