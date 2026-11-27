import AppKit
import TodzKit

private let declinedKey = "declinesHiddenMenuBarItemNotice"
private let menuBarSettingsAddress = "x-apple.systempreferences:com.apple.ControlCenter-Settings.extension"
private let settlingPause = Duration.seconds(2)

@MainActor final class MenuBarItemNotice {
    private let defaults: UserDefaults
    private var isOffered = false
    private var isWaiting = false

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func offerIfHidden() async {
        let isQuiet = isOffered || isWaiting || defaults.bool(forKey: declinedKey)
        guard !isQuiet else { return }
        isWaiting = true
        defer { isWaiting = false }
        do {
            try await Task.sleep(for: settlingPause)
        } catch {
            return
        }
        guard let itemFrame = Self.statusItemFrame() else { return }
        guard !MenuBarItemPlacement.isOnTheBar(itemFrame: itemFrame, screenFrames: NSScreen.screens.map(\.frame)) else { return }
        isOffered = true
        offer()
    }

    private func offer() {
        let alert = Self.makeAlert()
        NSApp.activate()
        let response = alert.runModal()
        if alert.suppressionButton?.state == .on { defaults.set(true, forKey: declinedKey) }
        guard response == .alertFirstButtonReturn, let address = URL(string: menuBarSettingsAddress) else { return }
        NSWorkspace.shared.open(address)
    }

    static func makeAlert() -> NSAlert {
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
