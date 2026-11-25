import AppKit
import TodzKit

private func activationPolicy(_ activation: AppActivation) -> NSApplication.ActivationPolicy {
    switch activation {
    case .regular: .regular
    case .accessory: .accessory
    }
}

extension AppDelegate {
    func observeWindows() {
        let keyObservation = NotificationCenter.default.addObserver(
            forName: NSWindow.didBecomeKeyNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.applyActivationPolicy(closing: nil) }
        }
        let closeObservation = NotificationCenter.default.addObserver(
            forName: NSWindow.willCloseNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            let closingWindow = notification.object as? NSWindow
            MainActor.assumeIsolated { self?.applyActivationPolicy(closing: closingWindow) }
        }
        windowObservations = [keyObservation, closeObservation]
        Task { applyActivationPolicy(closing: nil) }
    }

    // NB ADR 0074: the policy follows the visible windows that can become main, so the popover and the glance never count.
    private func applyActivationPolicy(closing closingWindow: NSWindow?) {
        let visibleWindowCount = NSApp.windows.filter { $0 !== closingWindow && $0.isVisible && $0.canBecomeMain }.count
        let activation = ActivationPolicyRule.policy(isSettingOn: menuBarOnlyPreference.isOn, visibleWindowCount: visibleWindowCount)
        let policy = activationPolicy(activation)
        guard NSApp.activationPolicy() != policy else { return }
        NSApp.setActivationPolicy(policy)
        guard policy == .regular else { return }
        NSApp.activate()
    }
}
