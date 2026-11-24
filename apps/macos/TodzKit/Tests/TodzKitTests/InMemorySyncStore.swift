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

@MainActor final class InMemorySyncStore: SyncStore {
    var owner: OwnerCache?
    var projects: [String: ProjectCache] = [:]
    var outbox: Data?
    var calls: [StoreCall] = []
    var failures: [StoreRoute: SyncStoreError] = [:]
    var onCall: ((StoreCall) -> Void)?

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

    nonisolated func readOwner() throws -> OwnerCache? {
        try MainActor.assumeIsolated {
            try record(.readOwner)
            return owner
        }
    }

    nonisolated func writeOwner(_ cache: OwnerCache) throws {
        try MainActor.assumeIsolated {
            try record(.writeOwner(cache))
            owner = cache
        }
    }

    nonisolated func readProject(identifier: String) throws -> ProjectCache? {
        try MainActor.assumeIsolated {
            try record(.readProject(identifier: identifier))
            return projects[identifier]
        }
    }

    nonisolated func writeProject(_ cache: ProjectCache) throws {
        try MainActor.assumeIsolated {
            try record(.writeProject(cache))
            projects[cache.projectIdentifier] = cache
        }
    }

    nonisolated func eraseProject(identifier: String) throws {
        try MainActor.assumeIsolated {
            try record(.eraseProject(identifier: identifier))
            projects[identifier] = nil
        }
    }

    nonisolated func readOutbox() throws -> Data? {
        try MainActor.assumeIsolated {
            try record(.readOutbox)
            return outbox
        }
    }

    nonisolated func writeOutbox(_ data: Data) throws {
        try MainActor.assumeIsolated {
            try record(.writeOutbox(data))
            outbox = data
        }
    }

    nonisolated func erase() throws {
        try MainActor.assumeIsolated {
            try record(.erase)
            owner = nil
            projects = [:]
            outbox = nil
        }
    }

    private func record(_ call: StoreCall) throws {
        calls.append(call)
        onCall?(call)
        guard let failure = failures[call.route] else { return }
        throw failure
    }
}
