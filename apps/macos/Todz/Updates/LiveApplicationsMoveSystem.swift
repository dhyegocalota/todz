import AppKit
import Darwin
import TodzKit

private let securityFrameworkPath = "/System/Library/Frameworks/Security.framework/Security"
private let isTranslocatedSymbol = "SecTranslocateIsTranslocatedURL"
private let originalPathSymbol = "SecTranslocateCreateOriginalPathForURL"

private typealias IsTranslocatedFunction = @convention(c) (CFURL, UnsafeMutablePointer<DarwinBoolean>, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> DarwinBoolean
private typealias OriginalPathFunction = @convention(c) (CFURL, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> Unmanaged<CFURL>?

struct LiveApplicationsMoveSystem: ApplicationsMoveSystem {
    nonisolated(unsafe) private static let securityHandle = dlopen(securityFrameworkPath, RTLD_LAZY)

    func runningApplications() -> [RunningTodz] {
        NSWorkspace.shared.runningApplications.map {
            RunningTodz(processIdentifier: $0.processIdentifier, bundleIdentifier: $0.bundleIdentifier, bundleURL: $0.bundleURL)
        }
    }

    func itemExists(at url: URL) -> Bool {
        (try? FileManager.default.attributesOfItem(atPath: url.path)) != nil
    }

    func originalURL(of bundle: URL) -> URL? {
        guard isTranslocated(bundle) else { return bundle }
        guard let function = securitySymbol(originalPathSymbol, as: OriginalPathFunction.self) else { return nil }
        return function(bundle as CFURL, nil)?.takeRetainedValue() as URL?
    }

    func trash(_ url: URL) throws {
        try FileManager.default.trashItem(at: url, resultingItemURL: nil)
    }

    func remove(_ url: URL) throws {
        try FileManager.default.removeItem(at: url)
    }

    func copy(from source: URL, to destination: URL) throws {
        try FileManager.default.copyItem(at: source, to: destination)
    }

    func rename(_ staging: URL, to destination: URL) throws {
        try ExclusiveRename.perform(from: staging, to: destination)
    }

    func hasMatchingDesignatedRequirement(copy: URL) -> Bool {
        var runningCode: SecCode?
        var runningStaticCode: SecStaticCode?
        var requirement: SecRequirement?
        var copiedCode: SecStaticCode?
        guard SecCodeCopySelf([], &runningCode) == errSecSuccess, let runningCode else { return false }
        guard SecCodeCopyStaticCode(runningCode, [], &runningStaticCode) == errSecSuccess, let runningStaticCode else { return false }
        guard SecCodeCopyDesignatedRequirement(runningStaticCode, [], &requirement) == errSecSuccess, let requirement else { return false }
        guard SecStaticCodeCreateWithPath(copy as CFURL, [], &copiedCode) == errSecSuccess, let copiedCode else { return false }
        let flags = SecCSFlags(rawValue: kSecCSCheckNestedCode | kSecCSCheckAllArchitectures)
        return SecStaticCodeCheckValidity(copiedCode, flags, requirement) == errSecSuccess
    }

    func removeQuarantine(from bundle: URL) throws {
        try QuarantineRemoval.remove(from: bundle)
    }

    func isTranslocated(_ url: URL) -> Bool {
        guard let function = securitySymbol(isTranslocatedSymbol, as: IsTranslocatedFunction.self) else { return false }
        var isTranslocated: DarwinBoolean = false
        let didAnswer = function(url as CFURL, &isTranslocated, nil)
        return didAnswer.boolValue && isTranslocated.boolValue
    }

    private func securitySymbol<Function>(_ name: String, as type: Function.Type) -> Function? {
        guard let handle = Self.securityHandle else { return nil }
        guard let symbol = dlsym(handle, name) else { return nil }
        return unsafeBitCast(symbol, to: type)
    }
}
