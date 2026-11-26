import AppKit
import TodzKit

#if DEBUG
private let isDebugBuild = true
#else
private let isDebugBuild = false
#endif

@MainActor final class ApplicationsMoveOffer {
    private let bundle: Bundle
    private let defaults: UserDefaults
    private let currentVersion: String
    private let bundleIdentifier: String
    private let hasUpdateFeed: Bool
    private let system = LiveApplicationsMoveSystem()

    init?(bundle: Bundle, defaults: UserDefaults = .standard) {
        guard let info = bundle.infoDictionary, let currentVersion = AppVersion.of(info: info) else { return nil }
        guard let bundleIdentifier = bundle.bundleIdentifier else { return nil }
        self.bundle = bundle
        self.defaults = defaults
        self.currentVersion = currentVersion
        self.bundleIdentifier = bundleIdentifier
        hasUpdateFeed = UpdateFeed(info: info) != nil
    }

    func offerIfNeeded() {
        let shouldOffer = ApplicationsMove.shouldOffer(
            bundlePath: bundle.bundlePath,
            isTranslocated: system.isTranslocated(bundle.bundleURL),
            homeDirectory: NSHomeDirectory(),
            currentVersion: currentVersion,
            declinedVersion: ApplicationsMove.declinedVersion(defaults: defaults),
            hasUpdateFeed: hasUpdateFeed,
            isDebugBuild: isDebugBuild
        )
        guard shouldOffer else { return }
        let alert = makeAlert(message: UpdateCopy.moveToApplications)
        alert.informativeText = UpdateCopy.moveToApplicationsDetail
        ApplicationsMoveChoice.alertButtonOrder.forEach { alert.addButton(withTitle: Self.title(for: $0)) }
        let buttonIndex = alert.runModal().rawValue - NSApplication.ModalResponse.alertFirstButtonReturn.rawValue
        guard ApplicationsMoveChoice.of(alertButtonIndex: buttonIndex) == .move else {
            ApplicationsMove.decline(version: currentVersion, defaults: defaults)
            return
        }
        move()
    }

    private static func title(for choice: ApplicationsMoveChoice) -> String {
        switch choice {
        case .notNow: UpdateCopy.moveToApplicationsDecline
        case .move: UpdateCopy.moveToApplicationsConfirm
        }
    }

    private func move() {
        let run = ApplicationsMoveRun(
            system: system,
            bundleIdentifier: bundleIdentifier,
            processIdentifier: ProcessInfo.processInfo.processIdentifier,
            destinationFolder: URL(filePath: ApplicationsMove.destinationFolderPath)
        )
        switch run.move(bundle: bundle.bundleURL) {
        case .moved(let destination), .movedLeavingOriginal(let destination):
            relaunch(at: destination)
        case .refused(let refusal):
            showLine(Self.line(for: refusal))
        }
    }

    private func relaunch(at destination: URL) {
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.createsNewApplicationInstance = true
        NSWorkspace.shared.openApplication(at: destination, configuration: configuration) { _, error in
            let didOpen = error == nil
            Task { @MainActor in
                guard didOpen else { return self.showLine(UpdateCopy.moveToApplicationsOpenFailed) }
                NSApp.terminate(nil)
            }
        }
    }

    private func showLine(_ line: String) {
        makeAlert(message: line).runModal()
    }

    private func makeAlert(message: String) -> NSAlert {
        let alert = NSAlert()
        alert.messageText = message
        return alert
    }

    private static func line(for refusal: ApplicationsMoveRefusal) -> String {
        switch refusal {
        case .otherTodzRunning: UpdateCopy.quitTheOtherTodzFirst
        case .alreadyInPlace, .destinationOccupied: UpdateCopy.alreadyInApplications
        case .rollbackFailed: UpdateCopy.moveToApplicationsRollbackFailed
        case .unresolvedPath, .originalUnknown, .stagingNotCleared, .copyFailed, .signatureMismatch, .quarantineNotStripped, .installFailed: UpdateCopy.moveToApplicationsFailed
        }
    }
}
