import Foundation
@testable import TodzKit

enum StoreRoute: Hashable, Sendable {
    case readOwner
    case writeOwner
    case readProject
    case writeProject
    case eraseProject
    case readOutbox
    case writeOutbox
    case erase
}

enum StoreCall: Equatable, Sendable {
    case readOwner
    case writeOwner(OwnerCache)
    case readProject(identifier: String)
    case writeProject(ProjectCache)
    case eraseProject(identifier: String)
    case readOutbox
    case writeOutbox(Data)
    case erase

    var route: StoreRoute {
        switch self {
        case .readOwner: .readOwner
        case .writeOwner: .writeOwner
        case .readProject: .readProject
        case .writeProject: .writeProject
        case .eraseProject: .eraseProject
        case .readOutbox: .readOutbox
        case .writeOutbox: .writeOutbox
        case .erase: .erase
        }
    }
}

final class InMemorySyncStore: SyncStore, @unchecked Sendable {
    private let lock = NSLock()
    var owner: OwnerCache?
    var projects: [String: ProjectCache] = [:]
    var outbox: Data?
    var calls: [StoreCall] = []
    var failures: [StoreRoute: SyncStoreError] = [:]
    var onCall: ((StoreCall) -> Void)?
    private(set) var mainThreadProjectWrites = 0

    func routes() -> [StoreRoute] {
        calls.map(\.route)
    }

    func keep(_ outbox: Outbox) throws {
        self.outbox = try OwnerCoding.encoder().encode(outbox)
    }

    func storedOutbox() throws -> Outbox? {
        guard let outbox else { return nil }
        return try OwnerCoding.decoder().decode(Outbox.self, from: outbox)
    }

    func readOwner() throws -> OwnerCache? {
        lock.lock()
        defer { lock.unlock() }
        try record(.readOwner)
        return owner
    }

    func writeOwner(_ cache: OwnerCache) throws {
        lock.lock()
        defer { lock.unlock() }
        try record(.writeOwner(cache))
        owner = cache
    }

    func readProject(identifier: String) throws -> ProjectCache? {
        lock.lock()
        defer { lock.unlock() }
        try record(.readProject(identifier: identifier))
        return projects[identifier]
    }

    func writeProject(_ cache: ProjectCache) throws {
        lock.lock()
        defer { lock.unlock() }
        if Thread.isMainThread { mainThreadProjectWrites += 1 }
        try record(.writeProject(cache))
        projects[cache.projectIdentifier] = cache
    }

    func eraseProject(identifier: String) throws {
        lock.lock()
        defer { lock.unlock() }
        try record(.eraseProject(identifier: identifier))
        projects[identifier] = nil
    }

    func readOutbox() throws -> Data? {
        lock.lock()
        defer { lock.unlock() }
        try record(.readOutbox)
        return outbox
    }

    func writeOutbox(_ data: Data) throws {
        lock.lock()
        defer { lock.unlock() }
        try record(.writeOutbox(data))
        outbox = data
    }

    func erase() throws {
        lock.lock()
        defer { lock.unlock() }
        try record(.erase)
        owner = nil
        projects = [:]
        outbox = nil
    }

    private func record(_ call: StoreCall) throws {
        calls.append(call)
        onCall?(call)
        guard let failure = failures[call.route] else { return }
        throw failure
    }
}
