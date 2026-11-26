import AppKit
import Darwin
import TodzKit

private let securityFrameworkPath = "/System/Library/Frameworks/Security.framework/Security"
private let isTranslocatedSymbol = "SecTranslocateIsTranslocatedURL"
private let originalPathSymbol = "SecTranslocateCreateOriginalPathForURL"
private let quarantineAttributeName = "com.apple.quarantine"

private typealias IsTranslocatedFunction = @convention(c) (CFURL, UnsafeMutablePointer<DarwinBoolean>, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> DarwinBoolean
private typealias OriginalPathFunction = @convention(c) (CFURL, UnsafeMutablePointer<Unmanaged<CFError>?>?) -> Unmanaged<CFURL>?

private enum LiveApplicationsMoveFailure: Error {
    case unresolvedPath
    case trashRefused
    case quarantineUnreadable
    case quarantineKept
}

struct LiveApplicationsMoveSystem: ApplicationsMoveSystem {
    func canonicalURL(of url: URL) throws -> URL {
        guard let resolvedPath = realpath(url.path, nil) else { throw LiveApplicationsMoveFailure.unresolvedPath }
        defer { free(resolvedPath) }
        return URL(filePath: String(cString: resolvedPath))
    }

    func runningApplications() -> [RunningTodz] {
        NSWorkspace.shared.runningApplications.map {
            RunningTodz(processIdentifier: $0.processIdentifier, bundleIdentifier: $0.bundleIdentifier, bundleURL: $0.bundleURL)
        }
    }

    func itemExists(at url: URL) -> Bool {
        FileManager.default.fileExists(atPath: url.path)
    }

    func originalURL(of bundle: URL) -> URL? {
        guard isTranslocated(bundle) else { return bundle }
        guard let function = securitySymbol(originalPathSymbol, as: OriginalPathFunction.self) else { return nil }
        return function(bundle as CFURL, nil)?.takeRetainedValue() as URL?
    }

    func trash(_ url: URL) throws -> URL {
        var trashedURL: NSURL?
        try FileManager.default.trashItem(at: url, resultingItemURL: &trashedURL)
        guard let trashedURL else { throw LiveApplicationsMoveFailure.trashRefused }
        return trashedURL as URL
    }

    func copy(from source: URL, to destination: URL) throws {
        try FileManager.default.copyItem(at: source, to: destination)
    }

    func restore(_ trashed: URL, to destination: URL) throws {
        try FileManager.default.moveItem(at: trashed, to: destination)
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
        guard let enumerator = FileManager.default.enumerator(at: bundle, includingPropertiesForKeys: nil) else { throw LiveApplicationsMoveFailure.quarantineUnreadable }
        let paths = ([bundle] + enumerator.compactMap { $0 as? URL }).map(\.path)
        let isStripped = paths.allSatisfy { removexattr($0, quarantineAttributeName, XATTR_NOFOLLOW) == 0 || errno == ENOATTR }
        guard isStripped else { throw LiveApplicationsMoveFailure.quarantineKept }
    }

    func isTranslocated(_ url: URL) -> Bool {
        guard let function = securitySymbol(isTranslocatedSymbol, as: IsTranslocatedFunction.self) else { return false }
        var isTranslocated: DarwinBoolean = false
        let didAnswer = function(url as CFURL, &isTranslocated, nil)
        return didAnswer.boolValue && isTranslocated.boolValue
    }

    private func securitySymbol<Function>(_ name: String, as type: Function.Type) -> Function? {
        guard let handle = dlopen(securityFrameworkPath, RTLD_LAZY) else { return nil }
        guard let symbol = dlsym(handle, name) else { return nil }
        return unsafeBitCast(symbol, to: type)
    }
}
