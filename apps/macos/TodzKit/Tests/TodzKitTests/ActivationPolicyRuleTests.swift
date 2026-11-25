import Testing
@testable import TodzKit

private let openWindowCounts = [1, 2]
private let everyWindowCount = [0, 1, 2]
private let everySetting = [true, false]

@Suite struct ActivationPolicyRuleTests {
    @Test func aClosedWindowWithTheSettingOnIsAnAccessory() {
        #expect(ActivationPolicyRule.policy(isSettingOn: true, visibleWindowCount: 0) == .accessory)
    }

    @Test(arguments: openWindowCounts)
    func anOpenWindowWithTheSettingOnIsRegular(visibleWindowCount: Int) {
        #expect(ActivationPolicyRule.policy(isSettingOn: true, visibleWindowCount: visibleWindowCount) == .regular)
    }

    @Test(arguments: everyWindowCount)
    func theSettingOffIsAlwaysRegular(visibleWindowCount: Int) {
        #expect(ActivationPolicyRule.policy(isSettingOn: false, visibleWindowCount: visibleWindowCount) == .regular)
    }

    @Test(arguments: everySetting)
    func aWindowAboutToOpenIsRegularBeforeItShows(isSettingOn: Bool) {
        #expect(ActivationPolicyRule.policyForAnOpeningWindow(isSettingOn: isSettingOn) == .regular)
    }
}
