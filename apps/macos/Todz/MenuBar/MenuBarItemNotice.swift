import AppKit
import TodzKit

private let declinedKey = "declinesHiddenMenuBarItemNotice"
private let menuBarSettingsAddress = "x-apple.systempreferences:com.apple.ControlCenter-Settings.extension"

@MainActor final class MenuBarItemNotice {
    private let defaults: UserDefaults
    private let gate: ProactiveGate
    private var screenObservation: (any NSObjectProtocol)?
    private lazy var check = HiddenMenuBarItemCheck(
        gate: gate,
        isDeclined: { [defaults] in defaults.bool(forKey: declinedKey) },
        pause: { try await Task.sleep(for: $0) },
        itemFrame: { Self.statusItemFrame() },
        screenFrames: { NSScreen.screens.map(\.frame) },
        offer: { [weak self] in self?.offer() }
    )

    init(gate: ProactiveGate, defaults: UserDefaults = .standard) {
        self.gate = gate
        self.defaults = defaults
    }

    func start() {
        screenObservation = NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.recheck() }
        }
        recheck()
    }

    func recheck() {
        Task { await check.run() }
    }

    private func offer() {
        let alert = Self.makeAlert()
        NSApp.activate()
        let response = alert.runModal()
        if alert.suppressionButton?.state == .on { defaults.set(true, forKey: declinedKey) }
        guard response == .alertFirstButtonReturn, let address = URL(string: menuBarSettingsAddress) else { return }
        NSWorkspace.shared.open(address)
    }

    private static func makeAlert() -> NSAlert {
        let alert = NSAlert()
        alert.messageText = MenuBarCopy.hiddenItemTitle
        alert.informativeText = MenuBarCopy.hiddenItemDetail
        alert.addButton(withTitle: MenuBarCopy.hiddenItemOpenSettings)
        alert.addButton(withTitle: MenuBarCopy.hiddenItemNotNow)
        alert.showsSuppressionButton = true
        alert.suppressionButton?.title = MenuBarCopy.hiddenItemSuppression
        return alert
    }

    private static func statusItemFrame() -> CGRect? {
        let button = NSApp.windows.lazy.compactMap { $0.contentView.flatMap(statusBarButton(in:)) }.first
        guard let button, let window = button.window else { return nil }
        return window.convertToScreen(button.convert(button.bounds, to: nil))
    }

    private static func statusBarButton(in view: NSView) -> NSStatusBarButton? {
        if let button = view as? NSStatusBarButton { return button }
        return view.subviews.lazy.compactMap(statusBarButton(in:)).first
    }
}
