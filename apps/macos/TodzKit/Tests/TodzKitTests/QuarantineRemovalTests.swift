import Darwin
import Foundation
import Testing
@testable import TodzKit

private let quarantineValue = "0081;00000000;Safari;"
private let readableMode: Int16 = 0o755
private let unreadableMode: Int16 = 0o000

@Suite struct QuarantineRemovalTests {
    private let root: URL
    private let nested: URL

    init() throws {
        root = URL.temporaryDirectory.appending(path: UUID().uuidString).appending(path: "Todz.app")
        nested = root.appending(path: "Contents").appending(path: "MacOS")
        try FileManager.default.createDirectory(at: nested, withIntermediateDirectories: true)
        try "x".write(to: nested.appending(path: "todz"), atomically: true, encoding: .utf8)
    }

    private func quarantine(_ url: URL) {
        setxattr(url.path, QuarantineRemoval.attributeName, quarantineValue, quarantineValue.utf8.count, 0, 0)
    }

    private func isQuarantined(_ url: URL) -> Bool {
        getxattr(url.path, QuarantineRemoval.attributeName, nil, 0, 0, 0) >= 0
    }

    @Test func theRootAndEveryNestedItemLoseTheirQuarantine() throws {
        let file = nested.appending(path: "todz")
        [root, nested, file].forEach(quarantine)
        try QuarantineRemoval.remove(from: root)
        #expect([root, nested, file].allSatisfy { !isQuarantined($0) })
    }

    @Test func itemsThatWereNeverQuarantinedAreNotAFailure() throws {
        try QuarantineRemoval.remove(from: root)
    }

    @Test func aFolderThatCannotBeReadIsAFailure() throws {
        try FileManager.default.setAttributes([.posixPermissions: unreadableMode], ofItemAtPath: nested.path)
        defer { try? FileManager.default.setAttributes([.posixPermissions: readableMode], ofItemAtPath: nested.path) }
        #expect(throws: QuarantineRemovalFailure.self) { try QuarantineRemoval.remove(from: root) }
    }

    @Test func aBundleThatDoesNotExistIsAFailure() {
        #expect(throws: QuarantineRemovalFailure.self) { try QuarantineRemoval.remove(from: root.appending(path: "missing")) }
    }
}
