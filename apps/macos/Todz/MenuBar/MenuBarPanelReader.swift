import AppKit
import SwiftUI

struct MenuBarPanelReader: NSViewRepresentable {
    let panel: MenuBarPanel
    let onBecomeKey: () -> Void

    func makeNSView(context: Context) -> MenuBarPanelView {
        MenuBarPanelView()
    }

    func updateNSView(_ view: MenuBarPanelView, context: Context) {
        view.panel = panel
        view.onBecomeKey = onBecomeKey
        panel.window = view.window
    }
}

final class MenuBarPanelView: NSView {
    var panel: MenuBarPanel?
    var onBecomeKey: (() -> Void)?
    private var keyObservation: (any NSObjectProtocol)?

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        panel?.window = window
        stopObservingKey()
        guard let window else { return }
        if window.isKeyWindow { onBecomeKey?() }
        keyObservation = NotificationCenter.default.addObserver(
            forName: NSWindow.didBecomeKeyNotification,
            object: window,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.onBecomeKey?() }
        }
    }

    private func stopObservingKey() {
        guard let keyObservation else { return }
        NotificationCenter.default.removeObserver(keyObservation)
        self.keyObservation = nil
    }
}
