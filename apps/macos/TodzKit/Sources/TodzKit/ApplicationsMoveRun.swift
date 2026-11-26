import Foundation

public struct ApplicationsMoveRun {
    private let system: any ApplicationsMoveSystem
    private let bundleIdentifier: String
    private let processIdentifier: Int32
    private let destinationFolder: URL

    public init(system: any ApplicationsMoveSystem, bundleIdentifier: String, processIdentifier: Int32, destinationFolder: URL) {
        self.system = system
        self.bundleIdentifier = bundleIdentifier
        self.processIdentifier = processIdentifier
        self.destinationFolder = destinationFolder
    }

    // NB ADR 0105: nothing at the destination is ever displaced; the copy is built under a staging name, verified, then renamed into place.
    public func move(bundle: URL) -> ApplicationsMoveOutcome {
        guard let sourceIdentity = FileIdentity.of(bundle) else { return .refused(.unresolvedPath) }
        guard FileIdentity.of(destinationFolder) != nil else { return .refused(.unresolvedPath) }
        guard let original = system.originalURL(of: bundle) else { return .refused(.originalUnknown) }
        guard let originalIdentity = FileIdentity.of(original) else { return .refused(.unresolvedPath) }
        let destination = destinationFolder.appending(path: ApplicationsMove.bundleFileName)
        let staging = destinationFolder.appending(path: ApplicationsMove.stagingFileName)
        let isInPlace = FileIdentity.of(destination).map { [sourceIdentity, originalIdentity].contains($0) } == true
        guard !isInPlace else { return .refused(.alreadyInPlace) }
        guard !system.itemExists(at: destination) else { return .refused(.destinationOccupied) }
        let isOtherTodzRunning = system.runningApplications().contains { $0.processIdentifier != processIdentifier && $0.bundleIdentifier == bundleIdentifier }
        guard !isOtherTodzRunning else { return .refused(.otherTodzRunning) }
        do {
            try clearStaging(at: staging)
            try install(source: bundle, staging: staging, destination: destination)
        } catch {
            return .refused(error)
        }
        guard (try? system.trash(original)) != nil else { return .movedLeavingOriginal(destination: destination) }
        return .moved(destination: destination)
    }

    private func clearStaging(at staging: URL) throws(ApplicationsMoveRefusal) {
        guard system.itemExists(at: staging) else { return }
        do {
            try system.remove(staging)
        } catch {
            throw .stagingNotCleared
        }
    }

    private func install(source: URL, staging: URL, destination: URL) throws(ApplicationsMoveRefusal) {
        do {
            try buildVerifiedCopy(from: source, at: staging)
            try rename(staging, to: destination)
        } catch {
            try discard(staging)
            throw error
        }
    }

    private func buildVerifiedCopy(from source: URL, at staging: URL) throws(ApplicationsMoveRefusal) {
        do {
            try system.copy(from: source, to: staging)
        } catch {
            throw .copyFailed
        }
        guard system.hasMatchingDesignatedRequirement(copy: staging) else { throw .signatureMismatch }
        do {
            try system.removeQuarantine(from: staging)
        } catch {
            throw .quarantineNotStripped
        }
    }

    private func rename(_ staging: URL, to destination: URL) throws(ApplicationsMoveRefusal) {
        do {
            try system.rename(staging, to: destination)
        } catch {
            throw .installFailed
        }
    }

    private func discard(_ staging: URL) throws(ApplicationsMoveRefusal) {
        guard system.itemExists(at: staging) else { return }
        do {
            try system.remove(staging)
        } catch {
            throw .rollbackFailed
        }
    }
}
