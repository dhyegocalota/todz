import AppKit
import TodzKit

extension AppDelegate {
    // NB ADR 0033: a widget's Darwin notification only triggers an intake; the app decides what each request may change.
    func observeWidgetRequests() {
        let observer = Unmanaged.passUnretained(self).toOpaque()
        let name = WidgetNotification.requestsAdded as CFString
        CFNotificationCenterAddObserver(CFNotificationCenterGetDarwinNotifyCenter(), observer, { _, observer, _, _, _ in
            guard let observer else { return }
            let delegate = Unmanaged<AppDelegate>.fromOpaque(observer).takeUnretainedValue()
            Task { @MainActor in await delegate.model.takeWidgetRequests() }
        }, name, nil, .deliverImmediately)
    }

    func observeDayChanges() {
        dayChangeObservation = NotificationCenter.default.addObserver(
            forName: .NSCalendarDayChanged,
            object: nil,
            queue: .main
        ) { [model] _ in
            MainActor.assumeIsolated { model.dayChanged() }
        }
    }
}
