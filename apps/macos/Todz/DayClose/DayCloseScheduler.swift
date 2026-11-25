import AppKit
import TodzKit

private let recheckedNotifications: [Notification.Name] = [
    .NSSystemTimeZoneDidChange,
    .NSSystemClockDidChange,
    .NSCalendarDayChanged,
    UserDefaults.didChangeNotification,
]
private let shortestCheckDelay: Duration = .seconds(1)

@MainActor final class DayCloseScheduler {
    private let coordinator: DayCloseCoordinator
    private var nextCheck: Task<Void, Never>?
    private var observations: [any NSObjectProtocol] = []

    init(coordinator: DayCloseCoordinator) {
        self.coordinator = coordinator
    }

    func start() {
        let wakeObservation = observe(NSWorkspace.didWakeNotification, in: NSWorkspace.shared.notificationCenter)
        observations = [wakeObservation] + recheckedNotifications.map { observe($0, in: .default) }
        check()
    }

    private func observe(_ name: Notification.Name, in center: NotificationCenter) -> any NSObjectProtocol {
        center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.check() }
        }
    }

    private func check() {
        nextCheck?.cancel()
        switch coordinator.check() {
        case let .notYet(next), let .doneToday(next): checkAgain(at: next)
        case .off, .due: return
        }
    }

    private func checkAgain(at next: Date) {
        nextCheck = Task { [weak self] in
            do {
                try await Task.sleep(for: max(.seconds(next.timeIntervalSinceNow), shortestCheckDelay))
            } catch {
                return
            }
            self?.check()
        }
    }
}
