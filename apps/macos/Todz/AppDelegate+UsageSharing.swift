import AppKit
import TodzKit

private let successStatus = 204
private let escapeKeyEquivalent = "\u{1b}"

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
        UsageSharingPrompt.buttonsInOrder.forEach { answer in
            let button = alert.addButton(withTitle: UsageSharingCopy.title(of: answer))
            if answer == UsageSharingPrompt.escapeAnswer { button.keyEquivalent = escapeKeyEquivalent }
        }
        let responseIndex = alert.runModal().rawValue - NSApplication.ModalResponse.alertFirstButtonReturn.rawValue
        usageSharingPreference.answer(isSharing: UsageSharingPrompt.answer(forButtonIndex: responseIndex) == .share)
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
