import Foundation

public struct SocketChangeSignals: ChangeSignals {
    private let baseURL: URL

    public init(baseURL: URL) {
        self.baseURL = baseURL
    }

    public func watch(session: String, projectIdentifier: String) -> AsyncThrowingStream<ChangeSignalEvent, any Error> {
        fatalError("SocketChangeSignals.watch is not implemented")
    }

    func socketRequest(session: String, projectIdentifier: String) throws -> URLRequest {
        fatalError("SocketChangeSignals.socketRequest is not implemented")
    }
}
