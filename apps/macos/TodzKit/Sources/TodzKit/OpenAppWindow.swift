public enum OpenAppWindow {
    // NB ADR 0074: a minimized window still counts as open, so todz keeps its Dock icon to bring it back.
    public static func counts(isVisible: Bool, isMiniaturized: Bool, canBecomeMain: Bool, isTitledAppWindow: Bool) -> Bool {
        let isShownAppWindow = isVisible && canBecomeMain
        let isMinimizedAppWindow = isMiniaturized && isTitledAppWindow
        return isShownAppWindow || isMinimizedAppWindow
    }
}
