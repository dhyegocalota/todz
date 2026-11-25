import AppKit
import TodzKit

extension NSWindow {
    var isOpenAppWindow: Bool {
        OpenAppWindow.counts(isVisible: isVisible, isMiniaturized: isMiniaturized, canBecomeMain: canBecomeMain)
    }
}
