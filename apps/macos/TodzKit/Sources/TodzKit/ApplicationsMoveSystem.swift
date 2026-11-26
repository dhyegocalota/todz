import Foundation

public struct RunningTodz: Equatable, Sendable {
    public let processIdentifier: Int32
    public let bundleIdentifier: String?
    public let bundleURL: URL?

    public init(processIdentifier: Int32, bundleIdentifier: String?, bundleURL: URL?) {
        self.processIdentifier = processIdentifier
        self.bundleIdentifier = bundleIdentifier
        self.bundleURL = bundleURL
    }
}

public protocol ApplicationsMoveSystem {
    func canonicalURL(of url: URL) throws -> URL
    func runningApplications() -> [RunningTodz]
    func itemExists(at url: URL) -> Bool
    func originalURL(of bundle: URL) -> URL?
    func trash(_ url: URL) throws -> URL
    func copy(from source: URL, to destination: URL) throws
    func restore(_ trashed: URL, to destination: URL) throws
    func hasMatchingDesignatedRequirement(copy: URL) -> Bool
    func removeQuarantine(from bundle: URL) throws
}
