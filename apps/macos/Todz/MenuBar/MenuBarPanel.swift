import AppKit
import Observation
import SwiftUI
import TodzKit

@MainActor @Observable final class MenuBarPanel {
    @ObservationIgnored weak var window: NSWindow?
    @ObservationIgnored private var applicationBeforeEngaging: NSRunningApplication?

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
        let isUnengagedClosingDay = dayClose.isClosingDay && !dayClose.isEngaged
        guard isUnengagedClosingDay else { return }
        let frontmostApplication = NSWorkspace.shared.frontmostApplication
        let isOtherApplication = frontmostApplication?.processIdentifier != ProcessInfo.processInfo.processIdentifier
        if isOtherApplication { applicationBeforeEngaging = frontmostApplication }
        dayClose.engage()
        NSApp.activate()
        window?.makeKey()
    }

    func closeReturningToTheApplicationBefore() {
        close()
        guard let applicationBeforeEngaging else { return }
        self.applicationBeforeEngaging = nil
        let hasOtherVisibleWindow = NSApp.windows.contains { $0.isVisible && $0.canBecomeMain }
        guard !hasOtherVisibleWindow else { return }
        applicationBeforeEngaging.activate()
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
