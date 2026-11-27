public enum ConnectedAppList: Equatable, Sendable {
    case loading
    case loaded([ConnectedApp])
    case failed(ConnectedAppListFailure)

    var isLoaded: Bool {
        guard case .loaded = self else { return false }
        return true
    }
}
