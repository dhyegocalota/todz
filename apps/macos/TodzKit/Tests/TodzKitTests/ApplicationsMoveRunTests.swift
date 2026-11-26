import Foundation
import Testing
@testable import TodzKit

private let ownBundleIdentifier = "app.todz.mac"
private let ownProcessIdentifier: Int32 = 100
private let otherProcessIdentifier: Int32 = 200
private let bundleContentName = "version.txt"
private let newContent = "new"
private let previousContent = "previous"
private let dataVolumePrefix = "/System/Volumes/Data"
private let privateRootPrefix = "/private"

@Suite struct ApplicationsMoveRunTests {
    private let scratchFolder: URL
    private let source: URL
    private let destinationFolder: URL
    private let destination: URL
    private let staging: URL
    private let system: ScratchApplicationsMoveSystem

    init() throws {
        scratchFolder = URL.temporaryDirectory.appending(path: UUID().uuidString)
        source = scratchFolder.appending(path: "downloads").appending(path: ApplicationsMove.bundleFileName)
        destinationFolder = scratchFolder.appending(path: "applications")
        destination = destinationFolder.appending(path: ApplicationsMove.bundleFileName)
        staging = destinationFolder.appending(path: ApplicationsMove.stagingFileName)
        system = ScratchApplicationsMoveSystem(trashFolder: scratchFolder.appending(path: "trash"))
        system.originalBundle = source
        try writeBundle(at: source, content: newContent)
        try FileManager.default.createDirectory(at: destinationFolder, withIntermediateDirectories: true)
    }

    private func writeBundle(at url: URL, content: String) throws {
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        try content.write(to: url.appending(path: bundleContentName), atomically: true, encoding: .utf8)
    }

    private func content(of bundle: URL) throws -> String {
        try String(contentsOf: bundle.appending(path: bundleContentName), encoding: .utf8)
    }

    private func exists(_ url: URL) -> Bool {
        system.itemExists(at: url)
    }

    private func move(bundle: URL, into folder: URL) -> ApplicationsMoveOutcome {
        ApplicationsMoveRun(
            system: system,
            bundleIdentifier: ownBundleIdentifier,
            processIdentifier: ownProcessIdentifier,
            destinationFolder: folder
        ).move(bundle: bundle)
    }

    private func move(bundle: URL) -> ApplicationsMoveOutcome {
        move(bundle: bundle, into: destinationFolder)
    }

    private func move(into folder: URL) -> ApplicationsMoveOutcome {
        move(bundle: source, into: folder)
    }

    private func move() -> ApplicationsMoveOutcome {
        move(bundle: source, into: destinationFolder)
    }

    private func runningTodz(processIdentifier: Int32, bundleURL: URL?) -> RunningTodz {
        RunningTodz(processIdentifier: processIdentifier, bundleIdentifier: ownBundleIdentifier, bundleURL: bundleURL)
    }

    @Test func aMoveIntoAnEmptyFolderInstallsTheVerifiedCopyAndTrashesTheOriginal() throws {
        #expect(move() == .moved(destination: destination))
        #expect(try content(of: destination) == newContent)
        #expect(!exists(source))
        #expect(!exists(staging))
        #expect(system.strippedBundles == [staging])
    }

    @Test func anythingAtTheDestinationRefusesTheMoveAndChangesNothing() throws {
        try writeBundle(at: destination, content: previousContent)
        #expect(move() == .refused(.destinationOccupied))
        #expect(try content(of: destination) == previousContent)
        #expect(try content(of: source) == newContent)
        #expect(!exists(staging))
    }

    @Test func aBrokenSymbolicLinkAtTheDestinationRefusesTheMove() throws {
        try FileManager.default.createSymbolicLink(at: destination, withDestinationURL: scratchFolder.appending(path: "missing"))
        #expect(move() == .refused(.destinationOccupied))
        #expect(!exists(staging))
    }

    @Test func aBundleAlreadyAtTheDestinationThroughASymbolicLinkIsRefused() throws {
        let link = scratchFolder.appending(path: "link")
        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: destinationFolder)
        try writeBundle(at: destination, content: previousContent)
        #expect(move(bundle: link.appending(path: ApplicationsMove.bundleFileName)) == .refused(.alreadyInPlace))
        #expect(try content(of: destination) == previousContent)
    }

    @Test func aBundleAlreadyAtTheDestinationThroughTheDataVolumeIsRefused() throws {
        try writeBundle(at: destination, content: previousContent)
        let throughDataVolume = URL(filePath: dataVolumePrefix + privateRootPrefix + destination.path)
        #expect(move(bundle: throughDataVolume) == .refused(.alreadyInPlace))
        #expect(try content(of: destination) == previousContent)
    }

    @Test func aTranslocatedBundleWhoseOriginalIsTheDestinationIsRefused() throws {
        try writeBundle(at: destination, content: previousContent)
        system.originalBundle = destination
        #expect(move() == .refused(.alreadyInPlace))
        #expect(try content(of: destination) == previousContent)
    }

    @Test func aTranslocatedBundleWhoseOriginalIsUnknownIsRefused() throws {
        system.originalBundle = nil
        #expect(move() == .refused(.originalUnknown))
        #expect(!exists(destination))
        #expect(!exists(staging))
        #expect(try content(of: source) == newContent)
    }

    @Test func anotherTodzRunningAnywhereRefusesTheMove() throws {
        system.running = [runningTodz(processIdentifier: otherProcessIdentifier, bundleURL: scratchFolder.appending(path: "elsewhere"))]
        #expect(move() == .refused(.otherTodzRunning))
        #expect(!exists(destination))
        #expect(!exists(staging))
        #expect(try content(of: source) == newContent)
    }

    @Test func thisProcessRunningFromTheSourceDoesNotBlockTheMove() {
        system.running = [runningTodz(processIdentifier: ownProcessIdentifier, bundleURL: source)]
        #expect(move() == .moved(destination: destination))
    }

    @Test func aStagingBundleLeftByAnEarlierKillIsRemovedBeforeTheCopy() throws {
        try writeBundle(at: staging, content: previousContent)
        #expect(move() == .moved(destination: destination))
        #expect(try content(of: destination) == newContent)
        #expect(!exists(staging))
    }

    @Test func aStagingBundleThatCannotBeRemovedRefusesTheMove() throws {
        try writeBundle(at: staging, content: previousContent)
        system.failingSteps = [.removeStaging]
        #expect(move() == .refused(.stagingNotCleared))
        #expect(!exists(destination))
        #expect(try content(of: source) == newContent)
    }

    @Test func aCopyThatFailsLeavesNothingBehindAndTheOriginalWhereItWas() throws {
        system.failingSteps = [.copy]
        #expect(move() == .refused(.copyFailed))
        #expect(!exists(staging))
        #expect(!exists(destination))
        #expect(system.strippedBundles.isEmpty)
        #expect(try content(of: source) == newContent)
    }

    @Test func aCopyThatFailsAndCannotBeCleanedUpIsReported() {
        system.failingSteps = [.copy, .removeStaging]
        #expect(move() == .refused(.rollbackFailed))
    }

    @Test func aSignatureMismatchRemovesTheStagingBundleAndInstallsNothing() throws {
        system.hasMatchingRequirement = false
        #expect(move() == .refused(.signatureMismatch))
        #expect(!exists(staging))
        #expect(!exists(destination))
        #expect(system.strippedBundles.isEmpty)
        #expect(try content(of: source) == newContent)
    }

    @Test func aQuarantineThatCannotBeStrippedRemovesTheStagingBundleAndInstallsNothing() throws {
        system.failingSteps = [.quarantine]
        #expect(move() == .refused(.quarantineNotStripped))
        #expect(!exists(staging))
        #expect(!exists(destination))
        #expect(try content(of: source) == newContent)
    }

    @Test func aRenameThatFailsRemovesTheStagingBundleAndInstallsNothing() throws {
        system.failingSteps = [.rename]
        #expect(move() == .refused(.installFailed))
        #expect(!exists(staging))
        #expect(!exists(destination))
        #expect(try content(of: source) == newContent)
    }

    @Test func anOriginalThatCannotBeTrashedStaysAndTheMoveStillSucceeds() throws {
        let sourceIdentity = try #require(FileIdentity.of(source))
        system.untrashableBundles = [sourceIdentity]
        #expect(move() == .movedLeavingOriginal(destination: destination))
        #expect(try content(of: source) == newContent)
        #expect(try content(of: destination) == newContent)
    }

    @Test func aDestinationFolderThatDoesNotExistIsRefused() {
        #expect(move(into: scratchFolder.appending(path: "missing")) == .refused(.unresolvedPath))
    }

    @Test func aBundleThatDoesNotExistIsRefused() {
        #expect(move(bundle: scratchFolder.appending(path: "missing")) == .refused(.unresolvedPath))
    }
}
