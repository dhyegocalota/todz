public struct UnavailableWidgetStore: WidgetStore {
    public init() {
        fatalError("UnavailableWidgetStore is not implemented")
    }

    public func readSnapshot() throws -> WidgetSnapshot? {
        nil
    }

    public func writeSnapshot(_ snapshot: WidgetSnapshot) throws {}

    public func eraseSnapshot() throws {}

    public func addRequest(_ request: WidgetRequest) throws {}

    public func requests() throws -> [StoredWidgetRequest] {
        []
    }

    public func removeRequests(_ names: [String]) throws {}

    public func erase() throws {}
}
