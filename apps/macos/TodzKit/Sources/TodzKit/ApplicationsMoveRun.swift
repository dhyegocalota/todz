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

    // NB ADR 0105: nothing is trashed while any other todz runs, the copy must pass the running bundle's designated requirement, and any failure puts everything back.
    public func move(bundle: URL) -> ApplicationsMoveOutcome {
        guard let source = try? system.canonicalURL(of: bundle) else { return .refused(.unresolvedPath) }
        guard let folder = try? system.canonicalURL(of: destinationFolder) else { return .refused(.unresolvedPath) }
        let destination = folder.appending(path: ApplicationsMove.bundleFileName)
        let resolvedDestination = try? system.canonicalURL(of: destination)
        let original = system.originalURL(of: bundle)
        let resolvedOriginal = original.flatMap { try? system.canonicalURL(of: $0) }
        let sourcePaths = [source, resolvedOriginal].compactMap { $0 }
        let isInPlace = sourcePaths.contains { $0 == resolvedDestination }
        guard !isInPlace else { return .refused(.alreadyInPlace) }
        let otherProcesses = system.runningApplications().filter { $0.processIdentifier != processIdentifier }
        let destinationPaths = [destination, resolvedDestination].compactMap { $0 }
        guard !otherProcesses.contains(where: { isRunning($0, atAnyOf: destinationPaths) }) else { return .refused(.destinationRunning) }
        guard !otherProcesses.contains(where: { $0.bundleIdentifier == bundleIdentifier }) else { return .refused(.otherTodzRunning) }
        do {
            try install(source: source, destination: destination)
        } catch {
            return .refused(error)
        }
        guard let original, (try? system.trash(original)) != nil else { return .movedLeavingOriginal(destination: destination) }
        return .moved(destination: destination)
    }

    private func isRunning(_ process: RunningTodz, atAnyOf paths: [URL]) -> Bool {
        guard let bundleURL = process.bundleURL else { return false }
        guard let resolvedBundleURL = try? system.canonicalURL(of: bundleURL) else { return false }
        return paths.contains(resolvedBundleURL)
    }

    private func install(source: URL, destination: URL) throws(ApplicationsMoveRefusal) {
        let previous = try displacePrevious(at: destination)
        do {
            try copyVerified(from: source, to: destination)
        } catch {
            try rollBack(destination: destination, previous: previous)
            throw error
        }
    }

    private func displacePrevious(at destination: URL) throws(ApplicationsMoveRefusal) -> URL? {
        guard system.itemExists(at: destination) else { return nil }
        do {
            return try system.trash(destination)
        } catch {
            throw .previousCopyNotTrashed
        }
    }

    private func copyVerified(from source: URL, to destination: URL) throws(ApplicationsMoveRefusal) {
        do {
            try system.copy(from: source, to: destination)
        } catch {
            throw .copyFailed
        }
        guard system.hasMatchingDesignatedRequirement(copy: destination) else { throw .signatureMismatch }
        do {
            try system.removeQuarantine(from: destination)
        } catch {
            throw .quarantineNotStripped
        }
    }

    private func rollBack(destination: URL, previous: URL?) throws(ApplicationsMoveRefusal) {
        do {
            if system.itemExists(at: destination) { _ = try system.trash(destination) }
            guard let previous else { return }
            try system.restore(previous, to: destination)
        } catch {
            throw .rollbackFailed
        }
    }
}
