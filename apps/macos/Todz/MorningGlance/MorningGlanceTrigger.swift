import AppKit
import TodzKit

private typealias Action = @MainActor (MorningGlanceCoordinator) async -> Void

private let chanceNotifications: [Notification.Name] = [
    NSWorkspace.didWakeNotification,
    NSWorkspace.screensDidWakeNotification,
    NSWorkspace.sessionDidBecomeActiveNotification,
]
private let closingNotifications: [Notification.Name] = [
    NSWorkspace.willSleepNotification,
    NSWorkspace.screensDidSleepNotification,
    NSWorkspace.sessionDidResignActiveNotification,
]

@MainActor final class MorningGlanceTrigger {
    private let coordinator: MorningGlanceCoordinator
    private var observations: [any NSObjectProtocol] = []

    init(coordinator: MorningGlanceCoordinator) {
        self.coordinator = coordinator
    }

    func start() {
        let workspaceCenter = NSWorkspace.shared.notificationCenter
        let distributedCenter = DistributedNotificationCenter.default()
        let check: Action = { await $0.check() }
        let retry: Action = { await $0.retryLockedChance() }
        let close: Action = { $0.closeNow() }
        observations =
            chanceNotifications.map { observe($0, in: workspaceCenter, perform: check) }
            + closingNotifications.map { observe($0, in: workspaceCenter, perform: close) }
            + [
                observe(.screenIsUnlocked, in: distributedCenter, perform: retry),
                observe(.screenIsLocked, in: distributedCenter, perform: close),
                observe(NSWorkspace.didActivateApplicationNotification, in: workspaceCenter, perform: retry),
            ]
        Task { await coordinator.check() }
    }

    private func observe(_ name: Notification.Name, in center: NotificationCenter, perform action: @escaping Action) -> any NSObjectProtocol {
        center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let coordinator = self?.coordinator else { return }
                Task { await action(coordinator) }
            }
        }
    }
}
