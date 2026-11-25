public typealias ServerConnectionFactory = @MainActor (ServerAddress) -> ServerConnection

public struct ServerConnection: Sendable {
    public let service: any OwnerService
    public let signals: any ChangeSignals

    public init(service: any OwnerService, signals: any ChangeSignals) {
        self.service = service
        self.signals = signals
    }
}
