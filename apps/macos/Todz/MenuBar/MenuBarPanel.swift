import AppKit
import Observation
import SwiftUI
import TodzKit

@MainActor @Observable final class MenuBarPanel {
    @ObservationIgnored weak var window: NSWindow?

    // NB ADR 0031: a close from code clicks the status item's own button so the next click reopens.
    func close() {
        guard let window, window.isVisible else { return }
        statusItemButton?.performClick(nil)
    }

    var isShown: Bool {
        window?.isVisible == true
    }

    // NB ADR 0055: an open from code clicks the status item's button, never while the popover shows.
    func open() async -> Bool {
        guard !isShown else { return true }
        guard let statusItemButton else { return false }
        NSApp.unhideWithoutActivation()
        statusItemButton.performClick(nil)
        return true
    }

    func engage(_ dayClose: DayCloseCoordinator) {
        dayClose.engage()
        NSApp.activate()
        window?.makeKey()
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
