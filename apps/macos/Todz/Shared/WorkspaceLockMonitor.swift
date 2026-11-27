import AppKit
import TodzKit

private let idleCheckInterval = Duration.seconds(10)
private let screensaverStarted = Notification.Name("com.apple.screensaver.didstart")
private let sleepNotifications: [Notification.Name] = [
    NSWorkspace.willSleepNotification,
    NSWorkspace.screensDidSleepNotification,
]

// NB ADR 0110: sleep, screen lock, screensaver and the idle timeout (no input delivered to todz) end an unlocked session.
@MainActor final class WorkspaceLockMonitor {
    private let model: AppModel
    private var observations: [any NSObjectProtocol] = []
    private var inputMonitor: Any?
    private var idleCheck: Task<Void, Never>?

    init(model: AppModel) {
        self.model = model
    }

    func start() {
        let workspaceCenter = NSWorkspace.shared.notificationCenter
        let distributedCenter = DistributedNotificationCenter.default()
        observations =
            sleepNotifications.map { relock(on: $0, in: workspaceCenter, because: .systemSleep) }
            + [
                relock(on: .screenIsLocked, in: distributedCenter, because: .screenLocked),
                relock(on: screensaverStarted, in: distributedCenter, because: .screensaverStarted),
            ]
        inputMonitor = NSEvent.addLocalMonitorForEvents(matching: .any) { [model] event in
            MainActor.assumeIsolated { model.noteWorkspaceLockInput() }
            return event
        }
        idleCheck = Task { [model] in
            while !Task.isCancelled {
                try? await Task.sleep(for: idleCheckInterval)
                await model.relockWorkspacesIfIdle()
            }
        }
    }

    private func relock(on name: Notification.Name, in center: NotificationCenter, because trigger: RelockTrigger) -> any NSObjectProtocol {
        center.addObserver(forName: name, object: nil, queue: .main) { [model] _ in
            Task { @MainActor in await model.relockWorkspaces(because: trigger) }
        }
    }
}
