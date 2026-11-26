import AppKit
import TodzKit

private let successStatus = 204

extension AppDelegate {
    @MainActor private static var isSendingUsage = false

    func startUsageSharing() {
        panel.onOpened = { [weak self] in self?.recordUsage(.popoverOpened) }
        panel.onDayClosed = { [usageSharing] in usageSharing.record(.dayClosed, at: Date()) }
        askAboutUsageSharingOnce()
        sendDueUsageRollup()
        observeMultipleWorkspaces()
    }

    private func recordUsage(_ event: UsageEvent) {
        usageSharing.record(event, at: Date())
        sendDueUsageRollup()
    }

    private func observeMultipleWorkspaces() {
        withObservationTracking {
            _ = model.workspaces
        } onChange: {
            Task { @MainActor [self] in
                if model.workspaces.count > 1 { usageSharing.record(.multiWorkspace, at: Date()) }
                observeMultipleWorkspaces()
            }
        }
    }

    private func askAboutUsageSharingOnce() {
        guard !usageSharingPreference.hasBeenAsked else { return }
        let alert = NSAlert()
        alert.messageText = UsageSharingCopy.askTitle
        alert.informativeText = UsageSharingCopy.askBody
        alert.addButton(withTitle: UsageSharingCopy.askShare)
        alert.addButton(withTitle: UsageSharingCopy.askDecline)
        usageSharingPreference.answer(isSharing: alert.runModal() == .alertFirstButtonReturn)
    }

    private func sendDueUsageRollup() {
        guard !Self.isSendingUsage else { return }
        let rollup = usageSharing.dueRollup(at: Date(), appVersion: AppConfiguration.appVersion, macosMajor: ProcessInfo.processInfo.operatingSystemVersion.majorVersion)
        guard let rollup else { return }
        let serverURL = model.serverURL.url
        Self.isSendingUsage = true
        Task { [usageSharing] in
            defer { Self.isSendingUsage = false }
            guard let request = try? rollup.request(baseURL: serverURL) else { return }
            guard let (_, response) = try? await URLSession.shared.data(for: request) else { return }
            guard (response as? HTTPURLResponse)?.statusCode == successStatus else { return }
            usageSharing.markSent()
        }
    }
}
