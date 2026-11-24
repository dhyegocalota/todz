public protocol ChangeSignals: Sendable {
    func watch(session: String, projectIdentifier: String) -> AsyncThrowingStream<ChangeSignalEvent, any Error>
}
