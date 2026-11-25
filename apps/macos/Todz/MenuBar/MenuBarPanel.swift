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

    // NB ADR 0055: an open from code unhides the app without activating it and clicks the same button, never while the popover shows, and answers true only when the window shows on the next turn.
    func open() async -> Bool {
        let isShown = window?.isVisible == true
        guard !isShown else { return true }
        guard let statusItemButton else { return false }
        NSApp.unhideWithoutActivation()
        statusItemButton.performClick(nil)
        await Task.yield()
        return window?.isVisible == true
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
