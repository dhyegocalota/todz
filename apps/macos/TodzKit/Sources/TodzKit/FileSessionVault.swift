import Foundation

public struct FileSessionVault: SessionVault, Sendable {
    private let folder: URL

    public init(folder: URL) {
        self.folder = folder
    }

    public func read() throws -> String? {
        fatalError("FileSessionVault is not implemented")
    }

    public func write(_ secret: String) throws {
        fatalError("FileSessionVault is not implemented")
    }

    public func erase() throws {
        fatalError("FileSessionVault is not implemented")
    }
}
