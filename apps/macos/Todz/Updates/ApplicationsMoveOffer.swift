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
        alert.addButton(withTitle: UpdateCopy.moveToApplicationsConfirm)
        alert.addButton(withTitle: UpdateCopy.moveToApplicationsDecline)
        NSApp.activate()
        guard alert.runModal() == .alertFirstButtonReturn else {
            ApplicationsMove.decline(version: currentVersion, defaults: defaults)
            return
        }
        move()
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
        case .otherTodzRunning, .destinationRunning: UpdateCopy.quitTheOtherTodzFirst
        case .alreadyInPlace: UpdateCopy.alreadyInApplications
        case .rollbackFailed: UpdateCopy.moveToApplicationsRollbackFailed
        case .unresolvedPath, .previousCopyNotTrashed, .copyFailed, .signatureMismatch, .quarantineNotStripped: UpdateCopy.moveToApplicationsFailed
        }
    }
}
