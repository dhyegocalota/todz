public enum ActivationPolicyRule {
    // NB ADR 0074: with the switch on, todz is an accessory app while no ordinary window is visible.
    public static func policy(isSettingOn: Bool, visibleWindowCount: Int) -> AppActivation {
        let isMenuBarOnly = isSettingOn && visibleWindowCount == 0
        guard isMenuBarOnly else { return .regular }
        return .accessory
    }

    public static func policyForAnOpeningWindow(isSettingOn: Bool) -> AppActivation {
        fatalError("ActivationPolicyRule.policyForAnOpeningWindow is not implemented")
    }
}
