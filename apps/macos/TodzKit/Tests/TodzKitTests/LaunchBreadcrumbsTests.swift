import Foundation
import Testing
@testable import TodzKit

private let fileName = "launch-breadcrumbs.log"
private let rotatedFileName = "launch-breadcrumbs.1.log"
private let smallByteLimit = 120

private func freshFolder() throws -> URL {
    let folder = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    return folder
}

private func lines(in folder: URL, named name: String) throws -> [String] {
    let text = try String(contentsOf: folder.appending(path: name), encoding: .utf8)
    return text.split(separator: "\n").map(String.init)
}

@Suite struct LaunchBreadcrumbsTests {
    @Test func eachEraseWritesOneLineWithTheTimestampThePathAndTheReason() throws {
        let folder = try freshFolder()
        let breadcrumbs = LaunchBreadcrumbs(folder: folder, now: { fixedInstant }, maxByteCount: LaunchBreadcrumbs.standardMaxByteCount)
        LaunchErase.allCases.forEach { breadcrumbs.record($0) }
        let written = try lines(in: folder, named: fileName)
        #expect(written.count == LaunchErase.allCases.count)
        #expect(zip(written, LaunchErase.allCases).allSatisfy { $0.contains($1.path) && $0.hasSuffix($1.reason) })
        #expect(written.allSatisfy { $0.hasPrefix(fixedInstant.formatted(.iso8601)) })
    }

    @Test func everyErasePathHasItsOwnPathAndReason() {
        #expect(Set(LaunchErase.allCases.map(\.reason)).count == LaunchErase.allCases.count)
        #expect(Set(LaunchErase.allCases.map(\.path)) == ["cachedOwner", "eraseDataOfAnotherServer", "cacheToOpen", "confirmOwner"])
    }

    @Test func aFileOverTheLimitRotatesToOneOlderFile() throws {
        let folder = try freshFolder()
        let breadcrumbs = LaunchBreadcrumbs(folder: folder, now: { fixedInstant }, maxByteCount: smallByteLimit)
        (0..<4).forEach { _ in breadcrumbs.record(.ownerMismatchAtLaunch) }
        let current = try lines(in: folder, named: fileName)
        let older = try lines(in: folder, named: rotatedFileName)
        #expect(!current.isEmpty)
        #expect(!older.isEmpty)
        #expect(current.count + older.count <= 4)
        #expect(!FileManager.default.fileExists(atPath: folder.appending(path: "launch-breadcrumbs.2.log").path(percentEncoded: false)))
    }
}
