public enum MorningGlanceFront {
    public static func isInFront(
        isDayCloseDue: Bool,
        isClosingDay: Bool,
        isPopoverShown: Bool,
        isApplicationActive: Bool,
        hasVisibleMainCapableWindow: Bool
    ) -> Bool {
        let isTodayWindowInFront = isApplicationActive && hasVisibleMainCapableWindow
        return isDayCloseDue || isClosingDay || isPopoverShown || isTodayWindowInFront
    }
}
