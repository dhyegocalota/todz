import Foundation

public struct FileWidgetStore: WidgetStore {
    private let folder: URL

    public init(folder: URL) {
        self.folder = folder
    }

    public func readSnapshot() throws -> WidgetSnapshot? {
        fatalError("FileWidgetStore is not implemented")
    }

    public func writeSnapshot(_ snapshot: WidgetSnapshot) throws {
        fatalError("FileWidgetStore is not implemented")
    }

    public func eraseSnapshot() throws {
        fatalError("FileWidgetStore is not implemented")
    }

    public func addRequest(_ request: WidgetRequest) throws {
        fatalError("FileWidgetStore is not implemented")
    }

    public func requests() throws -> [StoredWidgetRequest] {
        fatalError("FileWidgetStore is not implemented")
    }

    public func removeRequests(_ names: [String]) throws {
        fatalError("FileWidgetStore is not implemented")
    }

    public func erase() throws {
        fatalError("FileWidgetStore is not implemented")
    }
}
