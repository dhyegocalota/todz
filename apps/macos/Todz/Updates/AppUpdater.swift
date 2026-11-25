import Foundation
import Observation
import Sparkle
import TodzKit

@MainActor @Observable final class AppUpdater {
    private(set) var canCheckForUpdates = false
    private let controller: SPUStandardUpdaterController
    private var observation: NSKeyValueObservation?

    // NB ADR 0072: only a build whose Info.plist carries a feed starts Sparkle, so Debug never updates itself.
    init?(bundle: Bundle) {
        guard let info = bundle.infoDictionary, UpdateFeed(info: info) != nil else { return nil }
        controller = SPUStandardUpdaterController(startingUpdater: true, updaterDelegate: nil, userDriverDelegate: nil)
        observation = controller.updater.observe(\.canCheckForUpdates, options: [.initial, .new]) { [weak self] _, change in
            guard let canCheck = change.newValue else { return }
            Task { @MainActor in self?.canCheckForUpdates = canCheck }
        }
    }

    func checkForUpdates() {
        controller.checkForUpdates(nil)
    }
}
