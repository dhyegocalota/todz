import Foundation
@testable import TodzKit

enum ScratchStep: Hashable {
    case copy
    case removeStaging
    case rename
    case quarantine
}

struct ScratchFailure: Error {}

final class ScratchApplicationsMoveSystem: ApplicationsMoveSystem {
    var running: [RunningTodz] = []
    var failingSteps: Set<ScratchStep> = []
    var untrashableBundles: Set<FileIdentity> = []
    var hasMatchingRequirement = true
    var originalBundle: URL?
    private(set) var strippedBundles: [URL] = []
    private let trashFolder: URL
    private let manager = FileManager.default

    init(trashFolder: URL) {
        self.trashFolder = trashFolder
    }

    func runningApplications() -> [RunningTodz] {
        running
    }

    func itemExists(at url: URL) -> Bool {
        (try? manager.attributesOfItem(atPath: url.path)) != nil
    }

    func originalURL(of bundle: URL) -> URL? {
        originalBundle
    }

    func trash(_ url: URL) throws {
        guard let identity = FileIdentity.of(url), !untrashableBundles.contains(identity) else { throw ScratchFailure() }
        let trashed = trashFolder.appending(path: UUID().uuidString).appending(path: url.lastPathComponent)
        try manager.createDirectory(at: trashed.deletingLastPathComponent(), withIntermediateDirectories: true)
        try manager.moveItem(at: url, to: trashed)
    }

    func remove(_ url: URL) throws {
        guard !failingSteps.contains(.removeStaging) else { throw ScratchFailure() }
        try manager.removeItem(at: url)
    }

    func copy(from source: URL, to destination: URL) throws {
        guard !failingSteps.contains(.copy) else {
            try manager.createDirectory(at: destination, withIntermediateDirectories: true)
            throw ScratchFailure()
        }
        try manager.copyItem(at: source, to: destination)
    }

    func rename(_ staging: URL, to destination: URL) throws {
        guard !failingSteps.contains(.rename) else { throw ScratchFailure() }
        try manager.moveItem(at: staging, to: destination)
    }

    func hasMatchingDesignatedRequirement(copy: URL) -> Bool {
        hasMatchingRequirement
    }

    func removeQuarantine(from bundle: URL) throws {
        guard !failingSteps.contains(.quarantine) else { throw ScratchFailure() }
        strippedBundles.append(bundle)
    }
}
