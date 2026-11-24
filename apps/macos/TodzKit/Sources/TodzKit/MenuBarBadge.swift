public enum MenuBarBadge {
    public static let storageKey = "showsMenuBarCount"
    public static let isEnabledByDefault = true
    // NB ADR 0036: the count caps at 99 and reads 99+ above it.
    static let cap = 99

    public static func text(openCount: Int?, isEnabled: Bool) -> String? {
        guard isEnabled, let openCount, openCount > 0 else { return nil }
        guard openCount <= cap else { return "\(cap)+" }
        return "\(openCount)"
    }
}
