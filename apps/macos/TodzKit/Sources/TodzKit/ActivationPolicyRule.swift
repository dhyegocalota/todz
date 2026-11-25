private let openingWindowCount = 1

public enum ActivationPolicyRule {
    // NB ADR 0074: with the switch on, todz is an accessory app while no ordinary window is visible.
    public static func policy(isSettingOn: Bool, visibleWindowCount: Int) -> AppActivation {
        let isMenuBarOnly = isSettingOn && visibleWindowCount == 0
        guard isMenuBarOnly else { return .regular }
        return .accessory
    }

    // NB ADR 0074: a window about to open already counts, since a hidden app's window never becomes key on its own.
    public static func policyForAnOpeningWindow(isSettingOn: Bool) -> AppActivation {
        policy(isSettingOn: isSettingOn, visibleWindowCount: openingWindowCount)
    }
}
