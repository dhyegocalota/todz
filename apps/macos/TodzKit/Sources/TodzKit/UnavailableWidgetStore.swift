public struct UnavailableWidgetStore: WidgetStore {
    public init() {}

    public func readSnapshot() throws -> WidgetSnapshot? {
        nil
    }

    public func writeSnapshot(_ snapshot: WidgetSnapshot) throws {
        throw WidgetStoreError.unwritable
    }

    public func eraseSnapshot() throws {}

    public func addRequest(_ request: WidgetRequest) throws {
        throw WidgetStoreError.unwritable
    }

    public func requests() throws -> [StoredWidgetRequest] {
        []
    }

    public func removeRequests(_ names: [String]) throws -> [String] {
        []
    }

    public func erase() throws {}
}
