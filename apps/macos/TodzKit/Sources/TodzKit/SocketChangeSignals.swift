import Foundation

private let changedMessage = "changed"
private let socketSchemeOfScheme = ["http": "ws", "https": "wss"]

private let failureOfStatus: [ResponseStatus: OwnerAPIError] = [
    .unauthorized: .unauthorized,
    .notFound: .notFound,
    .upgradeRequired: .appTooOld(minimum: nil),
]

private func socketPath(_ projectIdentifier: String) -> String {
    "\(projectPath(projectIdentifier))/socket"
}

private func isChanged(_ message: URLSessionWebSocketTask.Message) -> Bool {
    guard case let .string(text) = message else { return false }
    return text == changedMessage
}

private func failure(of task: URLSessionTask) -> OwnerAPIError {
    let status = (task.response as? HTTPURLResponse).flatMap { ResponseStatus(rawValue: $0.statusCode) }
    guard let status, let failure = failureOfStatus[status] else { return .unreachable }
    return failure
}

private final class SocketWatch: NSObject, URLSessionWebSocketDelegate, Sendable {
    private let continuation: AsyncThrowingStream<ChangeSignalEvent, any Error>.Continuation

    init(continuation: AsyncThrowingStream<ChangeSignalEvent, any Error>.Continuation) {
        self.continuation = continuation
    }

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        continuation.yield(.opened)
        receive(on: webSocketTask)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: (any Error)?) {
        continuation.finish(throwing: failure(of: task))
    }

    private func receive(on task: URLSessionWebSocketTask) {
        task.receive { [self] received in
            guard case let .success(message) = received else {
                continuation.finish(throwing: failure(of: task))
                return
            }
            if isChanged(message) { continuation.yield(.changed) }
            receive(on: task)
        }
    }
}

// NB ADR 0029: one socket per shown project, opened with the session as a bearer, that only says "changed".
public struct SocketChangeSignals: ChangeSignals {
    private let baseURL: URL
    private let appVersion: String

    public init(baseURL: URL, appVersion: String) {
        self.baseURL = baseURL
        self.appVersion = appVersion
    }

    public func watch(session: String, projectIdentifier: String) -> AsyncThrowingStream<ChangeSignalEvent, any Error> {
        let (events, continuation) = AsyncThrowingStream<ChangeSignalEvent, any Error>.makeStream()
        let request: URLRequest
        do {
            request = try socketRequest(session: session, projectIdentifier: projectIdentifier)
        } catch {
            continuation.finish(throwing: error)
            return events
        }
        let transport = URLSession(configuration: .ephemeral, delegate: SocketWatch(continuation: continuation), delegateQueue: nil)
        let task = transport.webSocketTask(with: request)
        continuation.onTermination = { _ in
            task.cancel()
            transport.invalidateAndCancel()
        }
        task.resume()
        return events
    }

    func socketRequest(session: String, projectIdentifier: String) throws -> URLRequest {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else { throw OwnerAPIError.unreachable }
        guard let socketScheme = components.scheme.flatMap({ socketSchemeOfScheme[$0] }) else { throw OwnerAPIError.unreachable }
        components.scheme = socketScheme
        guard let socketBaseURL = components.url else { throw OwnerAPIError.unreachable }
        return try OwnerRequest(method: .get, path: socketPath(projectIdentifier), session: session).transportRequest(baseURL: socketBaseURL, appVersion: appVersion)
    }
}
