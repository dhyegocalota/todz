import Foundation
import Testing
@testable import TodzKit

private let ownBundleIdentifier = "app.todz.mac"
private let ownProcessIdentifier: Int32 = 100
private let otherProcessIdentifier: Int32 = 200
private let bundleName = "Todz.app"
private let bundleContentName = "version.txt"
private let newContent = "new"
private let previousContent = "previous"

@Suite struct ApplicationsMoveRunTests {
    private let scratchFolder: URL
    private let source: URL
    private let destinationFolder: URL
    private let destination: URL
    private let system: ScratchApplicationsMoveSystem

    init() throws {
        scratchFolder = URL.temporaryDirectory.appending(path: UUID().uuidString)
        source = scratchFolder.appending(path: "downloads").appending(path: bundleName)
        destinationFolder = scratchFolder.appending(path: "applications")
        destination = destinationFolder.appending(path: bundleName)
        system = ScratchApplicationsMoveSystem(trashFolder: scratchFolder.appending(path: "trash"))
        system.originalBundle = source
        try writeBundle(at: source, content: newContent)
        try FileManager.default.createDirectory(at: destinationFolder, withIntermediateDirectories: true)
    }

    private var resolvedDestination: URL {
        destinationFolder.resolvingSymlinksInPath().appending(path: bundleName)
    }

    private func writeBundle(at url: URL, content: String) throws {
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        try content.write(to: url.appending(path: bundleContentName), atomically: true, encoding: .utf8)
    }

    private func content(of bundle: URL) throws -> String {
        try String(contentsOf: bundle.appending(path: bundleContentName), encoding: .utf8)
    }

    private func move() -> ApplicationsMoveOutcome {
        ApplicationsMoveRun(
            system: system,
            bundleIdentifier: ownBundleIdentifier,
            processIdentifier: ownProcessIdentifier,
            destinationFolder: destinationFolder
        ).move(bundle: source)
    }

    private func runningTodz(processIdentifier: Int32, bundleIdentifier: String?, bundleURL: URL?) -> RunningTodz {
        RunningTodz(processIdentifier: processIdentifier, bundleIdentifier: bundleIdentifier, bundleURL: bundleURL)
    }

    @Test func aMoveIntoAnEmptyFolderCopiesTheBundleAndTrashesTheOriginal() throws {
        #expect(move() == .moved(destination: resolvedDestination))
        #expect(try content(of: destination) == newContent)
        #expect(!FileManager.default.fileExists(atPath: source.path))
        #expect(system.strippedBundles == [resolvedDestination])
    }

    @Test func aMoveReplacesAStoppedTodzAtTheDestination() throws {
        try writeBundle(at: destination, content: previousContent)
        #expect(move() == .moved(destination: resolvedDestination))
        #expect(try content(of: destination) == newContent)
    }

    @Test func thisProcessRunningFromTheSourceDoesNotBlockTheMove() {
        system.running = [runningTodz(processIdentifier: ownProcessIdentifier, bundleIdentifier: ownBundleIdentifier, bundleURL: source)]
        #expect(move() == .moved(destination: resolvedDestination))
    }

    @Test func anotherTodzRunningAnywhereRefusesTheMove() throws {
        try writeBundle(at: destination, content: previousContent)
        let elsewhere = scratchFolder.appending(path: "elsewhere").appending(path: bundleName)
        system.running = [runningTodz(processIdentifier: otherProcessIdentifier, bundleIdentifier: ownBundleIdentifier, bundleURL: elsewhere)]
        #expect(move() == .refused(.otherTodzRunning))
        #expect(try content(of: destination) == previousContent)
        #expect(try content(of: source) == newContent)
    }

    @Test func aRunningTodzAtTheDestinationRefusesTheMove() throws {
        try writeBundle(at: destination, content: previousContent)
        system.running = [runningTodz(processIdentifier: otherProcessIdentifier, bundleIdentifier: nil, bundleURL: destination)]
        #expect(move() == .refused(.destinationRunning))
        #expect(try content(of: destination) == previousContent)
        #expect(try content(of: source) == newContent)
    }

    @Test func aRunningTodzReachedThroughASymbolicLinkToTheDestinationRefusesTheMove() throws {
        try writeBundle(at: destination, content: previousContent)
        let link = scratchFolder.appending(path: "link")
        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: destinationFolder)
        system.running = [runningTodz(processIdentifier: otherProcessIdentifier, bundleIdentifier: nil, bundleURL: link.appending(path: bundleName))]
        #expect(move() == .refused(.destinationRunning))
        #expect(try content(of: destination) == previousContent)
    }

    @Test func aCopyThatFailsLeavesThePreviousCopyAndTheOriginalWhereTheyWere() throws {
        try writeBundle(at: destination, content: previousContent)
        system.failingSteps = [.copy]
        #expect(move() == .refused(.copyFailed))
        #expect(try content(of: destination) == previousContent)
        #expect(try content(of: source) == newContent)
        #expect(system.strippedBundles.isEmpty)
    }

    @Test func aCopyThatFailsIntoAnEmptyFolderLeavesNothingBehind() throws {
        system.failingSteps = [.copy]
        #expect(move() == .refused(.copyFailed))
        #expect(!FileManager.default.fileExists(atPath: destination.path))
        #expect(try content(of: source) == newContent)
    }

    @Test func aSignatureMismatchRemovesTheCopyAndBringsThePreviousOneBack() throws {
        try writeBundle(at: destination, content: previousContent)
        system.hasMatchingRequirement = false
        #expect(move() == .refused(.signatureMismatch))
        #expect(try content(of: destination) == previousContent)
        #expect(try content(of: source) == newContent)
        #expect(system.strippedBundles.isEmpty)
    }

    @Test func aSignatureMismatchIntoAnEmptyFolderLeavesNothingBehind() throws {
        system.hasMatchingRequirement = false
        #expect(move() == .refused(.signatureMismatch))
        #expect(!FileManager.default.fileExists(atPath: destination.path))
        #expect(try content(of: source) == newContent)
    }

    @Test func aQuarantineThatCannotBeStrippedRemovesTheCopyAndBringsThePreviousOneBack() throws {
        try writeBundle(at: destination, content: previousContent)
        system.failingSteps = [.quarantine]
        #expect(move() == .refused(.quarantineNotStripped))
        #expect(try content(of: destination) == previousContent)
        #expect(try content(of: source) == newContent)
    }

    @Test func aPreviousCopyThatCannotBeTrashedStopsTheMoveBeforeAnyCopy() throws {
        try writeBundle(at: destination, content: previousContent)
        system.untrashableBundles = [destination.resolvingSymlinksInPath()]
        #expect(move() == .refused(.previousCopyNotTrashed))
        #expect(try content(of: destination) == previousContent)
        #expect(try content(of: source) == newContent)
    }

    @Test func aPreviousCopyThatCannotBeBroughtBackIsReported() throws {
        try writeBundle(at: destination, content: previousContent)
        system.failingSteps = [.copy, .restore]
        #expect(move() == .refused(.rollbackFailed))
    }

    @Test func anOriginalThatCannotBeTrashedStaysAndTheMoveStillSucceeds() throws {
        system.untrashableBundles = [source.resolvingSymlinksInPath()]
        #expect(move() == .movedLeavingOriginal(destination: resolvedDestination))
        #expect(try content(of: source) == newContent)
    }

    @Test func anOriginalThatCannotBeLocatedStaysAndTheMoveStillSucceeds() throws {
        system.originalBundle = nil
        #expect(move() == .movedLeavingOriginal(destination: resolvedDestination))
        #expect(try content(of: source) == newContent)
    }

    @Test func aBundleAlreadyAtTheDestinationThroughASymbolicLinkIsRefused() throws {
        let link = scratchFolder.appending(path: "link")
        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: destinationFolder)
        try writeBundle(at: destination, content: previousContent)
        let run = ApplicationsMoveRun(
            system: system,
            bundleIdentifier: ownBundleIdentifier,
            processIdentifier: ownProcessIdentifier,
            destinationFolder: destinationFolder
        )
        #expect(run.move(bundle: link.appending(path: bundleName)) == .refused(.alreadyInPlace))
        #expect(try content(of: destination) == previousContent)
    }

    @Test func aTranslocatedBundleWhoseOriginalIsTheDestinationIsRefused() throws {
        try writeBundle(at: destination, content: previousContent)
        system.originalBundle = destination
        #expect(move() == .refused(.alreadyInPlace))
        #expect(try content(of: destination) == previousContent)
    }

    @Test func aDestinationFolderThatDoesNotExistIsRefused() {
        let run = ApplicationsMoveRun(
            system: system,
            bundleIdentifier: ownBundleIdentifier,
            processIdentifier: ownProcessIdentifier,
            destinationFolder: scratchFolder.appending(path: "missing")
        )
        #expect(run.move(bundle: source) == .refused(.unresolvedPath))
    }
}
