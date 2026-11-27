import Foundation
import os

private let logSubsystem = "dev.todz"
private let logCategory = "launch"
private let currentFileName = "launch-breadcrumbs.log"
private let olderFileName = "launch-breadcrumbs.1.log"
private let lineSeparator = "\n"
private let fieldSeparator = " "

public enum LaunchErase: CaseIterable, Sendable {
    case ownerCacheUnreadable
    case unreadableServer
    case sessionOfAnotherServer
    case ownerMismatchAtSignIn
    case ownerMismatchAtLaunch

    public var path: String {
        switch self {
        case .ownerCacheUnreadable: "cachedOwner"
        case .unreadableServer, .sessionOfAnotherServer: "eraseDataOfAnotherServer"
        case .ownerMismatchAtSignIn: "cacheToOpen"
        case .ownerMismatchAtLaunch: "confirmOwner"
        }
    }

    public var reason: String {
        switch self {
        case .ownerCacheUnreadable: "the owner cache could not be read"
        case .unreadableServer: "the stored server could not be read"
        case .sessionOfAnotherServer: "the stored session belongs to another server"
        case .ownerMismatchAtSignIn: "the cache belongs to another owner than the one who signed in"
        case .ownerMismatchAtLaunch: "the cache belongs to another owner than the one the session confirms"
        }
    }
}

// NB ADR 0121: one line per erase at launch, with the path and the reason and never task data.
public struct LaunchBreadcrumbs {
    public static let standardMaxByteCount = 16_384

    private let folder: URL?
    private let now: () -> Date
    private let maxByteCount: Int
    private let logger = Logger(subsystem: logSubsystem, category: logCategory)

    public init(folder: URL?, now: @escaping () -> Date, maxByteCount: Int) {
        self.folder = folder
        self.now = now
        self.maxByteCount = maxByteCount
    }

    public func record(_ erase: LaunchErase) {
        logger.notice("erase \(erase.path, privacy: .public): \(erase.reason, privacy: .public)")
        guard let folder else { return }
        let line = [now().formatted(.iso8601), erase.path, erase.reason].joined(separator: fieldSeparator) + lineSeparator
        rotateIfFull(in: folder)
        append(line, to: folder.appending(path: currentFileName))
    }

    private func rotateIfFull(in folder: URL) {
        let current = folder.appending(path: currentFileName)
        let size = try? current.resourceValues(forKeys: [.fileSizeKey]).fileSize
        guard let size, size >= maxByteCount else { return }
        let older = folder.appending(path: olderFileName)
        try? FileManager.default.removeItem(at: older)
        try? FileManager.default.moveItem(at: current, to: older)
    }

    private func append(_ line: String, to file: URL) {
        let data = Data(line.utf8)
        guard let handle = try? FileHandle(forWritingTo: file) else {
            try? data.write(to: file)
            return
        }
        defer { try? handle.close() }
        _ = try? handle.seekToEnd()
        try? handle.write(contentsOf: data)
    }
}
