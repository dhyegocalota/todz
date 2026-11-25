import AppKit
import TodzKit

extension AppDelegate {
    func observeWindows(_ launchActivation: LaunchActivation) {
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
        let visibilityObservation = NotificationCenter.default.addObserver(
            forName: NSWindow.didChangeOcclusionStateNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            let changedWindow = notification.object as? NSWindow
            MainActor.assumeIsolated {
                guard changedWindow?.canBecomeMain == true else { return }
                self?.applyActivationPolicy(closing: nil)
            }
        }
        windowObservations = [keyObservation, closeObservation, visibilityObservation]
        guard launchActivation == .atLaunch else { return }
        Task { applyActivationPolicy(closing: nil) }
    }

    // NB ADR 0074: the policy follows the open windows that can become main, so the popover and the glance never count.
    private func applyActivationPolicy(closing closingWindow: NSWindow?) {
        let isLaunchedForAnIntent = NSApp.activationPolicy() == .prohibited
        let isLeftAlone = isLaunchedForAnIntent || NSApp.isHidden
        guard !isLeftAlone else { return }
        let openWindowCount = NSApp.windows.filter { $0 !== closingWindow && $0.isOpenAppWindow }.count
        let activation = ActivationPolicyRule.policy(isSettingOn: menuBarOnlyPreference.isOn, visibleWindowCount: openWindowCount)
        let policy = NSApplication.ActivationPolicy(activation)
        guard NSApp.activationPolicy() != policy else { return }
        NSApp.setActivationPolicy(policy)
        guard policy == .regular else { return }
        NSApp.activate()
    }
}
