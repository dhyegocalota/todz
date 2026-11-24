public protocol WidgetStore: Sendable {
    func readSnapshot() throws -> WidgetSnapshot?
    func writeSnapshot(_ snapshot: WidgetSnapshot) throws
    func eraseSnapshot() throws
    func addRequest(_ request: WidgetRequest) throws
    func requests() throws -> [StoredWidgetRequest]
    func removeRequests(_ names: [String]) throws
    func erase() throws
}
