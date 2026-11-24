import AppKit
import Observation
import SwiftUI

@MainActor @Observable final class MenuBarPanel {
    @ObservationIgnored weak var window: NSWindow?

    // NB ADR 0031: a close from code clicks the status item's own button so the next click reopens.
    func close() {
        guard let window, window.isVisible else { return }
        statusItemButton?.performClick(nil)
    }

    func openMainWindow(_ openWindow: OpenWindowAction) {
        close()
        Task { openWindow.mainWindow() }
    }

    private var statusItemButton: NSStatusBarButton? {
        NSApp.windows
            .compactMap(\.contentView)
            .lazy
            .compactMap(Self.statusItemButton(in:))
            .first
    }

    private static func statusItemButton(in view: NSView) -> NSStatusBarButton? {
        guard let button = view as? NSStatusBarButton else {
            return view.subviews.lazy.compactMap(statusItemButton(in:)).first
        }
        return button
    }
}
