import AppKit
import TodzKit

extension NSWindow {
    var isOpenAppWindow: Bool {
        OpenAppWindow.counts(isVisible: isVisible, isMiniaturized: isMiniaturized, canBecomeMain: canBecomeMain, isTitledAppWindow: isTitledAppWindow)
    }

    private var isTitledAppWindow: Bool {
        styleMask.contains(.titled) && !(self is NSPanel)
    }
}
