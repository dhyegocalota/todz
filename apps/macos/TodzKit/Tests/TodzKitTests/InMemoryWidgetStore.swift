import Foundation
@testable import TodzKit

enum WidgetStoreRoute: Hashable, Sendable {
    case readSnapshot
    case writeSnapshot
    case eraseSnapshot
    case addRequest
    case requests
    case removeRequests
    case erase
    case reload
}

enum WidgetStoreCall: Equatable, Sendable {
    case readSnapshot
    case writeSnapshot(WidgetSnapshot)
    case eraseSnapshot
    case addRequest(WidgetRequest)
    case requests
    case removeRequests([String])
    case erase
    case reload

    var route: WidgetStoreRoute {
        switch self {
        case .readSnapshot: .readSnapshot
        case .writeSnapshot: .writeSnapshot
        case .eraseSnapshot: .eraseSnapshot
        case .addRequest: .addRequest
        case .requests: .requests
        case .removeRequests: .removeRequests
        case .erase: .erase
        case .reload: .reload
        }
    }
}

@MainActor final class InMemoryWidgetStore: WidgetStore {
    var snapshot: WidgetSnapshot?
    var storedRequests: [StoredWidgetRequest] = []
    var calls: [WidgetStoreCall] = []
    var failures: [WidgetStoreRoute: WidgetStoreError] = [:]
    var onCall: ((WidgetStoreCall) -> Void)?

    func routes() -> [WidgetStoreRoute] {
        calls.map(\.route)
    }

    func writtenSnapshots() -> [WidgetSnapshot] {
        calls.compactMap { call in
            guard case let .writeSnapshot(snapshot) = call else { return nil }
            return snapshot
        }
    }

    func recordReload() {
        calls.append(.reload)
        onCall?(.reload)
    }

    nonisolated func readSnapshot() throws -> WidgetSnapshot? {
        try MainActor.assumeIsolated {
            try record(.readSnapshot)
            return snapshot
        }
    }

    nonisolated func writeSnapshot(_ snapshot: WidgetSnapshot) throws {
        try MainActor.assumeIsolated {
            try record(.writeSnapshot(snapshot))
            self.snapshot = snapshot
        }
    }

    nonisolated func eraseSnapshot() throws {
        try MainActor.assumeIsolated {
            try record(.eraseSnapshot)
            snapshot = nil
        }
    }

    nonisolated func addRequest(_ request: WidgetRequest) throws {
        try MainActor.assumeIsolated {
            try record(.addRequest(request))
            storedRequests.append(StoredWidgetRequest(name: "\(UUID().uuidString).json", request: request))
        }
    }

    nonisolated func requests() throws -> [StoredWidgetRequest] {
        try MainActor.assumeIsolated {
            try record(.requests)
            return storedRequests
        }
    }

    nonisolated func removeRequests(_ names: [String]) throws {
        try MainActor.assumeIsolated {
            try record(.removeRequests(names))
            storedRequests.removeAll { names.contains($0.name) }
        }
    }

    nonisolated func erase() throws {
        try MainActor.assumeIsolated {
            try record(.erase)
            snapshot = nil
            storedRequests = []
        }
    }

    private func record(_ call: WidgetStoreCall) throws {
        calls.append(call)
        onCall?(call)
        guard let failure = failures[call.route] else { return }
        throw failure
    }
}
