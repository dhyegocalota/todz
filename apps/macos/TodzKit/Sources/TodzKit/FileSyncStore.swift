import Foundation

private let ownerFileName = "owner.json"
private let projectsFolderName = "projects"
private let outboxFileName = "outbox.json"
private let projectFileExtension = "json"

// NB ADR 0027: each owner's data is cached as JSON files in the app's own container until the app has a team.
public struct FileSyncStore: SyncStore {
    private let folder: URL

    public init(folder: URL) {
        self.folder = folder
    }

    private var ownerFile: URL {
        folder.appending(path: ownerFileName)
    }

    private var outboxFile: URL {
        folder.appending(path: outboxFileName)
    }

    private func projectFile(identifier: String) -> URL? {
        guard identifier.wholeMatch(of: /[A-Za-z0-9-]{1,64}/) != nil else { return nil }
        return folder.appending(path: projectsFolderName).appending(path: identifier).appendingPathExtension(projectFileExtension)
    }

    public func readOwner() throws -> OwnerCache? {
        try read(OwnerCache.self, from: ownerFile)
    }

    public func writeOwner(_ cache: OwnerCache) throws {
        try write(cache, to: ownerFile)
    }

    public func readProject(identifier: String) throws -> ProjectCache? {
        guard let file = projectFile(identifier: identifier) else { return nil }
        return try read(ProjectCache.self, from: file)
    }

    public func writeProject(_ cache: ProjectCache) throws {
        guard let file = projectFile(identifier: cache.projectIdentifier) else { throw SyncStoreError.unwritable }
        try write(cache, to: file)
    }

    public func eraseProject(identifier: String) throws {
        guard let file = projectFile(identifier: identifier) else { return }
        try remove(file)
    }

    public func readOutbox() throws -> Data? {
        try readData(from: outboxFile)
    }

    public func writeOutbox(_ data: Data) throws {
        try writeData(data, to: outboxFile)
    }

    public func erase() throws {
        try remove(folder)
    }

    private func readData(from file: URL) throws -> Data? {
        guard FileManager.default.fileExists(atPath: file.path(percentEncoded: false)) else { return nil }
        do {
            return try Data(contentsOf: file)
        } catch {
            throw SyncStoreError.unreadable
        }
    }

    private func read<Value: Decodable>(_ type: Value.Type, from file: URL) throws -> Value? {
        guard let data = try readData(from: file) else { return nil }
        do {
            return try OwnerCoding.decoder().decode(type, from: data)
        } catch {
            throw SyncStoreError.unreadable
        }
    }

    private func writeData(_ data: Data, to file: URL) throws {
        do {
            try PrivateFile.write(data, to: file)
        } catch {
            throw SyncStoreError.unwritable
        }
    }

    private func write(_ value: some Encodable, to file: URL) throws {
        do {
            try writeData(OwnerCoding.encoder().encode(value), to: file)
        } catch {
            throw SyncStoreError.unwritable
        }
    }

    private func remove(_ item: URL) throws {
        guard FileManager.default.fileExists(atPath: item.path(percentEncoded: false)) else { return }
        try FileManager.default.removeItem(at: item)
    }
}
