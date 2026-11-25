import AppKit
import SwiftUI
import TodzKit

struct MenuBarPanelReader: NSViewRepresentable {
    let panel: MenuBarPanel
    let onBecomeKey: () -> Void
    let onShow: () -> Void
    let onHide: () -> Void
    let onWorkspaceNumber: (Int) -> Void

    func makeNSView(context: Context) -> MenuBarPanelView {
        MenuBarPanelView()
    }

    func updateNSView(_ view: MenuBarPanelView, context: Context) {
        view.panel = panel
        view.onBecomeKey = onBecomeKey
        view.onShow = onShow
        view.onHide = onHide
        view.onWorkspaceNumber = onWorkspaceNumber
        panel.window = view.window
    }
}

final class MenuBarPanelView: NSView {
    var panel: MenuBarPanel?
    var onBecomeKey: (() -> Void)?
    var onShow: (() -> Void)?
    var onHide: (() -> Void)?
    var onWorkspaceNumber: ((Int) -> Void)?
    private var observations: [any NSObjectProtocol] = []

    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        let isCommandOnly = event.modifierFlags.intersection(.deviceIndependentFlagsMask) == .command
        guard isCommandOnly, let key = event.charactersIgnoringModifiers, let number = WorkspaceShortcuts.number(forKey: key) else {
            return super.performKeyEquivalent(with: event)
        }
        onWorkspaceNumber?(number)
        return true
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        panel?.window = window
        stopObserving()
        guard let window else { return }
        if window.isKeyWindow { onBecomeKey?() }
        if window.isVisible { onShow?() }
        let keyObservation = NotificationCenter.default.addObserver(
            forName: NSWindow.didBecomeKeyNotification,
            object: window,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.onBecomeKey?() }
        }
        let visibilityObservation = NotificationCenter.default.addObserver(
            forName: NSWindow.didChangeOcclusionStateNotification,
            object: window,
            queue: .main
        ) { [weak self, weak window] _ in
            MainActor.assumeIsolated {
                guard let window else { return }
                guard window.isVisible else {
                    self?.onHide?()
                    return
                }
                self?.onShow?()
            }
        }
        observations = [keyObservation, visibilityObservation]
    }

    private func stopObserving() {
        observations.forEach { NotificationCenter.default.removeObserver($0) }
        observations = []
    }
}
