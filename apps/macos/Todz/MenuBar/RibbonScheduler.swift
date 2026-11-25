import AppKit
import Observation
import TodzKit

private typealias Action = @MainActor (RibbonCoordinator) -> Void

private let refreshingNotifications: [Notification.Name] = [
    .NSSystemTimeZoneDidChange,
    .NSSystemClockDidChange,
    .NSCalendarDayChanged,
    UserDefaults.didChangeNotification,
]
private let endingWorkspaceNotifications: [Notification.Name] = [
    NSWorkspace.willSleepNotification,
    NSWorkspace.screensDidSleepNotification,
]

@MainActor final class RibbonScheduler {
    private let coordinator: RibbonCoordinator
    private let model: AppModel
    private var observations: [any NSObjectProtocol] = []
    private var agentChangeReaction: Task<Void, Never>?

    init(coordinator: RibbonCoordinator, model: AppModel) {
        self.coordinator = coordinator
        self.model = model
    }

    func start() {
        let workspaceCenter = NSWorkspace.shared.notificationCenter
        let distributedCenter = DistributedNotificationCenter.default()
        let refresh: Action = { $0.refresh() }
        let end: Action = { $0.end() }
        observations =
            refreshingNotifications.map { observe($0, in: .default, perform: refresh) }
            + endingWorkspaceNotifications.map { observe($0, in: workspaceCenter, perform: end) }
            + [
                observe(NSWorkspace.didWakeNotification, in: workspaceCenter, perform: refresh),
                observe(.screenIsUnlocked, in: distributedCenter, perform: refresh),
                observe(.screenIsLocked, in: distributedCenter, perform: end),
            ]
        observeAgentChanges()
        coordinator.refresh()
    }

    private func observe(_ name: Notification.Name, in center: NotificationCenter, perform action: @escaping Action) -> any NSObjectProtocol {
        center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let coordinator = self?.coordinator else { return }
                action(coordinator)
            }
        }
    }

    private func observeAgentChanges() {
        withObservationTracking {
            _ = model.agentChangeCount
        } onChange: { [weak self] in
            MainActor.assumeIsolated {
                self?.agentChangeReaction = Task { [weak self] in
                    self?.coordinator.agentChanged()
                    self?.observeAgentChanges()
                }
            }
        }
    }
}
