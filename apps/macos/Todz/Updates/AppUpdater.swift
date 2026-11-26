import Foundation
import Observation
import Sparkle
import TodzKit

private let shortVersionKey = "CFBundleShortVersionString"

@MainActor @Observable final class AppUpdater {
    private(set) var canCheckForUpdates = false
    private(set) var automaticallyUpdates: Bool
    private(set) var updatedToVersion: String?
    private let reminders = UpdateReminders()
    private let controller: SPUStandardUpdaterController
    private var observation: NSKeyValueObservation?

    // NB ADR 0072: only a build whose Info.plist carries a feed starts Sparkle, so Debug never updates itself.
    init?(bundle: Bundle) {
        guard let info = bundle.infoDictionary, UpdateFeed(info: info) != nil else { return nil }
        guard let currentVersion = info[shortVersionKey] as? String else { return nil }
        controller = SPUStandardUpdaterController(startingUpdater: true, updaterDelegate: nil, userDriverDelegate: reminders)
        automaticallyUpdates = controller.updater.automaticallyDownloadsUpdates
        updatedToVersion = Self.recordLaunch(ofVersion: currentVersion)
        observation = controller.updater.observe(\.canCheckForUpdates, options: [.initial, .new]) { [weak self] _, change in
            guard let canCheck = change.newValue else { return }
            Task { @MainActor in self?.canCheckForUpdates = canCheck }
        }
    }

    func checkForUpdates() {
        controller.checkForUpdates(nil)
    }

    func setAutomaticallyUpdates(_ isOn: Bool) {
        controller.updater.automaticallyDownloadsUpdates = isOn
        automaticallyUpdates = controller.updater.automaticallyDownloadsUpdates
    }

    func acknowledgeUpdate() {
        UserDefaults.standard.removeObject(forKey: UpdateNote.pendingVersionKey)
        updatedToVersion = nil
    }

    private static func recordLaunch(ofVersion currentVersion: String) -> String? {
        let defaults = UserDefaults.standard
        let recordedVersion = defaults.string(forKey: UpdateNote.lastLaunchedVersionKey)
        let pendingVersion = UpdateNote.pendingVersion(recorded: recordedVersion, current: currentVersion)
        defaults.set(currentVersion, forKey: UpdateNote.lastLaunchedVersionKey)
        if let pendingVersion {
            defaults.set(pendingVersion, forKey: UpdateNote.pendingVersionKey)
        }
        return defaults.string(forKey: UpdateNote.pendingVersionKey)
    }
}
