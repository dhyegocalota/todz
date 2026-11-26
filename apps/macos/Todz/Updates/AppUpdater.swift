import Foundation
import Observation
import Sparkle
import TodzKit

@MainActor @Observable final class AppUpdater {
    private(set) var canCheckForUpdates = false
    private(set) var automaticallyUpdates = false
    private(set) var updatedToVersion: String?
    private let reminders = UpdateReminders()
    private let controller: SPUStandardUpdaterController
    private var observations: [NSKeyValueObservation] = []

    // NB ADR 0072: only a build whose Info.plist carries a feed starts Sparkle, so Debug never updates itself.
    init?(bundle: Bundle) {
        guard let info = bundle.infoDictionary, UpdateFeed(info: info) != nil else { return nil }
        guard let currentVersion = AppVersion.of(info: info) else { return nil }
        controller = SPUStandardUpdaterController(startingUpdater: true, updaterDelegate: nil, userDriverDelegate: reminders)
        controller.updater.userAgentString = UpdateUserAgent.text(
            appVersion: currentVersion,
            sparkleVersion: Self.sparkleVersion,
            macosMajor: ProcessInfo.processInfo.operatingSystemVersion.majorVersion
        )
        automaticallyUpdates = controller.updater.automaticallyDownloadsUpdates
        updatedToVersion = UpdateNote.recordLaunch(ofVersion: currentVersion, defaults: .standard)
        observations = [
            controller.updater.observe(\.canCheckForUpdates, options: [.initial, .new]) { [weak self] _, change in
                guard let canCheck = change.newValue else { return }
                Task { @MainActor in self?.canCheckForUpdates = canCheck }
            },
            controller.updater.observe(\.automaticallyDownloadsUpdates, options: [.initial, .new]) { [weak self] _, change in
                guard let isOn = change.newValue else { return }
                Task { @MainActor in self?.automaticallyUpdates = isOn }
            },
        ]
    }

    private static var sparkleVersion: String {
        guard let version = Bundle(for: SPUUpdater.self).infoDictionary?["CFBundleShortVersionString"] as? String else {
            fatalError("The Sparkle framework's Info.plist has no version")
        }
        return version
    }

    func checkForUpdates() {
        controller.checkForUpdates(nil)
    }

    func setAutomaticallyUpdates(_ isOn: Bool) {
        controller.updater.automaticallyDownloadsUpdates = isOn
    }

    func acknowledgeUpdate() {
        UpdateNote.clearPendingVersion(defaults: .standard)
        updatedToVersion = nil
    }
}
