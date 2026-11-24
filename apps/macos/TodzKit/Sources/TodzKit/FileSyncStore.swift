import Foundation

// NB ADR 0027: each owner's data is cached as JSON files in the app's own container until the app has a team.
public struct FileSyncStore: SyncStore {
    private let folder: URL

    public init(folder: URL) {
        self.folder = folder
    }

    public func readOwner() throws -> OwnerCache? {
        fatalError("FileSyncStore.readOwner is not implemented")
    }

    public func writeOwner(_ cache: OwnerCache) throws {
        fatalError("FileSyncStore.writeOwner is not implemented")
    }

    public func readProject(identifier: String) throws -> ProjectCache? {
        fatalError("FileSyncStore.readProject is not implemented")
    }

    public func writeProject(_ cache: ProjectCache) throws {
        fatalError("FileSyncStore.writeProject is not implemented")
    }

    public func eraseProject(identifier: String) throws {
        fatalError("FileSyncStore.eraseProject is not implemented")
    }

    public func readOutbox() throws -> Data? {
        fatalError("FileSyncStore.readOutbox is not implemented")
    }

    public func writeOutbox(_ data: Data) throws {
        fatalError("FileSyncStore.writeOutbox is not implemented")
    }

    public func erase() throws {
        fatalError("FileSyncStore.erase is not implemented")
    }
}
