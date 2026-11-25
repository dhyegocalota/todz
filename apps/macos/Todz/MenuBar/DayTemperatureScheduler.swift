import AppKit
import TodzKit

private let refreshingNotifications: [Notification.Name] = [
    .NSSystemTimeZoneDidChange,
    .NSSystemClockDidChange,
    .NSCalendarDayChanged,
    UserDefaults.didChangeNotification,
]

@MainActor final class DayTemperatureScheduler {
    private let clock: DayTemperatureClock
    private var observations: [any NSObjectProtocol] = []

    init(clock: DayTemperatureClock) {
        self.clock = clock
    }

    func start() {
        let wakeObservation = observe(NSWorkspace.didWakeNotification, in: NSWorkspace.shared.notificationCenter)
        let unlockObservation = observe(.screenIsUnlocked, in: DistributedNotificationCenter.default())
        observations = [wakeObservation, unlockObservation] + refreshingNotifications.map { observe($0, in: .default) }
        clock.refresh()
    }

    private func observe(_ name: Notification.Name, in center: NotificationCenter) -> any NSObjectProtocol {
        center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.clock.refresh() }
        }
    }
}
