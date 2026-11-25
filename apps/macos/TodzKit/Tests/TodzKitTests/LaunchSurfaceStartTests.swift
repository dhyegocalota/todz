import Testing
@testable import TodzKit

@Suite struct LaunchSurfaceStartTests {
    @Test func aLaunchThatIsNotTheDefaultAndHasNoActivationWaitsForTheOwner() {
        #expect(LaunchSurfaceStart.of(isDefaultLaunch: false, isActivationProhibited: true) == .afterTheOwnerEngages)
    }

    @Test func aLaunchThatIsNotTheDefaultButCanActivateStartsAtOnce() {
        #expect(LaunchSurfaceStart.of(isDefaultLaunch: false, isActivationProhibited: false) == .now)
    }

    @Test func aDefaultLaunchStartsAtOnce() {
        #expect(LaunchSurfaceStart.of(isDefaultLaunch: true, isActivationProhibited: true) == .now)
        #expect(LaunchSurfaceStart.of(isDefaultLaunch: true, isActivationProhibited: false) == .now)
    }

    @Test func aLaunchThatNamesNoKindStartsAtOnce() {
        #expect(LaunchSurfaceStart.of(isDefaultLaunch: nil, isActivationProhibited: true) == .now)
        #expect(LaunchSurfaceStart.of(isDefaultLaunch: nil, isActivationProhibited: false) == .now)
    }
}
