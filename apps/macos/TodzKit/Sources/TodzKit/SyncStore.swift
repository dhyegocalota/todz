import Foundation

public protocol SyncStore: Sendable {
    func readOwner() throws -> OwnerCache?
    func writeOwner(_ cache: OwnerCache) throws
    func readProject(identifier: String) throws -> ProjectCache?
    func writeProject(_ cache: ProjectCache) throws
    func eraseProject(identifier: String) throws
    func readOutbox() throws -> Data?
    func writeOutbox(_ data: Data) throws
    func erase() throws
}
