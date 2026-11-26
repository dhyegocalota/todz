import AppKit
import Darwin
import TodzKit

private let securityFrameworkPath = "/System/Library/Frameworks/Security.framework/Security"
private let isTranslocatedSymbol = "SecTranslocateIsTranslocatedURL"
private let originalPathSymbol = "SecTranslocateCreateOriginalPathForURL"
private let quarantineAttributeName = "com.apple.quarantine"

private typealias IsTranslocatedFunction = @convention(c) (CFURL, UnsafeMutablePointer<DarwinBoolean>, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> DarwinBoolean
private typealias OriginalPathFunction = @convention(c) (CFURL, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> Unmanaged<CFURL>?

private enum ApplicationsMoveFailure: Error {
    case signature
    case quarantine
}

@MainActor final class ApplicationsMover {
    private let bundle: Bundle
    private let defaults: UserDefaults
    private let currentVersion: String
    private let hasUpdateFeed: Bool

    // NB ADR 0078: only a build that starts Sparkle is asked, once per version, and never when it already runs from an Applications folder.
    init?(bundle: Bundle, defaults: UserDefaults = .standard) {
        guard let info = bundle.infoDictionary, let currentVersion = AppVersion.of(info: info) else { return nil }
        self.bundle = bundle
        self.defaults = defaults
        self.currentVersion = currentVersion
        hasUpdateFeed = UpdateFeed(info: info) != nil
    }

    func offerIfNeeded() {
        let shouldOffer = ApplicationsMove.shouldOffer(
            bundlePath: bundle.bundlePath,
            isTranslocated: isTranslocated(bundle.bundleURL),
            homeDirectory: NSHomeDirectory(),
            currentVersion: currentVersion,
            declinedVersion: ApplicationsMove.declinedVersion(defaults: defaults),
            hasUpdateFeed: hasUpdateFeed
        )
        guard shouldOffer else { return }
        let alert = makeAlert(message: UpdateCopy.moveToApplications)
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
        let destination = URL(filePath: ApplicationsMove.destinationPath)
        let isOtherTodzRunning = NSWorkspace.shared.runningApplications.contains { $0.bundleURL?.path == ApplicationsMove.destinationPath }
        guard !isOtherTodzRunning else { return showLine(UpdateCopy.quitTheOtherTodzFirst) }
        let original = originalURL(of: bundle.bundleURL)
        do {
            try trashExisting(destination)
            try FileManager.default.copyItem(at: bundle.bundleURL, to: destination)
            try verifySignature(of: destination)
            try removeQuarantine(from: destination)
        } catch {
            try? trashExisting(destination)
            return showLine(UpdateCopy.moveToApplicationsFailed)
        }
        if let original {
            try? FileManager.default.trashItem(at: original, resultingItemURL: nil)
        }
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.createsNewApplicationInstance = true
        NSWorkspace.shared.openApplication(at: destination, configuration: configuration) { _, _ in
            Task { @MainActor in NSApp.terminate(nil) }
        }
    }

    private func trashExisting(_ destination: URL) throws {
        guard FileManager.default.fileExists(atPath: destination.path) else { return }
        try FileManager.default.trashItem(at: destination, resultingItemURL: nil)
    }

    private func verifySignature(of copy: URL) throws {
        var runningCode: SecCode?
        var requirement: SecRequirement?
        var copiedCode: SecStaticCode?
        var runningStaticCode: SecStaticCode?
        guard SecCodeCopySelf([], &runningCode) == errSecSuccess, let runningCode else { throw ApplicationsMoveFailure.signature }
        guard SecCodeCopyStaticCode(runningCode, [], &runningStaticCode) == errSecSuccess, let runningStaticCode else { throw ApplicationsMoveFailure.signature }
        guard SecCodeCopyDesignatedRequirement(runningStaticCode, [], &requirement) == errSecSuccess else { throw ApplicationsMoveFailure.signature }
        guard SecStaticCodeCreateWithPath(copy as CFURL, [], &copiedCode) == errSecSuccess, let copiedCode else { throw ApplicationsMoveFailure.signature }
        let flags = SecCSFlags(rawValue: kSecCSCheckNestedCode | kSecCSCheckAllArchitectures)
        guard SecStaticCodeCheckValidity(copiedCode, flags, requirement) == errSecSuccess else { throw ApplicationsMoveFailure.signature }
    }

    private func removeQuarantine(from root: URL) throws {
        guard let enumerator = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil) else { throw ApplicationsMoveFailure.quarantine }
        let paths = ([root] + enumerator.compactMap { $0 as? URL }).map(\.path)
        let isStripped = paths.allSatisfy { removexattr($0, quarantineAttributeName, XATTR_NOFOLLOW) == 0 || errno == ENOATTR }
        guard isStripped else { throw ApplicationsMoveFailure.quarantine }
    }

    private func showLine(_ line: String) {
        makeAlert(message: line).runModal()
    }

    private func makeAlert(message: String) -> NSAlert {
        let alert = NSAlert()
        alert.messageText = message
        return alert
    }

    private func isTranslocated(_ url: URL) -> Bool {
        guard let function = securitySymbol(isTranslocatedSymbol, as: IsTranslocatedFunction.self) else { return false }
        var isTranslocated: DarwinBoolean = false
        let didAnswer = function(url as CFURL, &isTranslocated, nil)
        return didAnswer.boolValue && isTranslocated.boolValue
    }

    private func originalURL(of url: URL) -> URL? {
        guard isTranslocated(url) else { return url }
        guard let function = securitySymbol(originalPathSymbol, as: OriginalPathFunction.self) else { return nil }
        return function(url as CFURL, nil)?.takeRetainedValue() as URL?
    }

    private func securitySymbol<Function>(_ name: String, as type: Function.Type) -> Function? {
        guard let handle = dlopen(securityFrameworkPath, RTLD_LAZY) else { return nil }
        guard let symbol = dlsym(handle, name) else { return nil }
        return unsafeBitCast(symbol, to: type)
    }
}
