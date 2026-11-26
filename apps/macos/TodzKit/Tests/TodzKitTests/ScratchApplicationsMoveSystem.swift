import Foundation
@testable import TodzKit

enum ScratchStep: Hashable {
    case copy
    case restore
    case quarantine
}

struct ScratchFailure: Error {}

final class ScratchApplicationsMoveSystem: ApplicationsMoveSystem {
    var running: [RunningTodz] = []
    var failingSteps: Set<ScratchStep> = []
    var untrashableBundles: Set<URL> = []
    var hasMatchingRequirement = true
    var originalBundle: URL?
    private(set) var strippedBundles: [URL] = []
    private let trashFolder: URL
    private let manager = FileManager.default

    init(trashFolder: URL) {
        self.trashFolder = trashFolder
    }

    func canonicalURL(of url: URL) throws -> URL {
        guard manager.fileExists(atPath: url.path) else { throw ScratchFailure() }
        return url.resolvingSymlinksInPath()
    }

    func runningApplications() -> [RunningTodz] {
        running
    }

    func itemExists(at url: URL) -> Bool {
        manager.fileExists(atPath: url.path)
    }

    func originalURL(of bundle: URL) -> URL? {
        originalBundle
    }

    func trash(_ url: URL) throws -> URL {
        guard !untrashableBundles.contains(url.resolvingSymlinksInPath()) else { throw ScratchFailure() }
        let trashed = trashFolder.appending(path: UUID().uuidString).appending(path: url.lastPathComponent)
        try manager.createDirectory(at: trashed.deletingLastPathComponent(), withIntermediateDirectories: true)
        try manager.moveItem(at: url, to: trashed)
        return trashed
    }

    func copy(from source: URL, to destination: URL) throws {
        guard !failingSteps.contains(.copy) else { throw ScratchFailure() }
        try manager.copyItem(at: source, to: destination)
    }

    func restore(_ trashed: URL, to destination: URL) throws {
        guard !failingSteps.contains(.restore) else { throw ScratchFailure() }
        try manager.moveItem(at: trashed, to: destination)
    }

    func hasMatchingDesignatedRequirement(copy: URL) -> Bool {
        hasMatchingRequirement
    }

    func removeQuarantine(from bundle: URL) throws {
        guard !failingSteps.contains(.quarantine) else { throw ScratchFailure() }
        strippedBundles.append(bundle)
    }
}
