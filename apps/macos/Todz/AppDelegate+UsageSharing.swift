import AppKit
import TodzKit

extension AppDelegate {
    func startUsageSharing() {
        panel.onOpened = { [usageSharing] in usageSharing.record(.popoverOpened, at: Date()) }
        askAboutUsageSharingOnce()
        sendDueUsageRollup()
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
        let rollup = usageSharing.dueRollup(at: Date(), appVersion: AppConfiguration.appVersion, macosMajor: ProcessInfo.processInfo.operatingSystemVersion.majorVersion)
        guard let rollup else { return }
        let serverURL = model.serverURL.url
        Task { [usageSharing] in
            guard let request = try? rollup.request(baseURL: serverURL) else { return }
            guard let (_, response) = try? await URLSession.shared.data(for: request) else { return }
            guard (response as? HTTPURLResponse)?.statusCode == 204 else { return }
            usageSharing.markSent()
        }
    }
}
