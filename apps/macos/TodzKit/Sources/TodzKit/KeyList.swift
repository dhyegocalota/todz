public enum KeyList: Equatable, Sendable {
    case loading
    case loaded([ProjectKey])
    case failed(KeyFailure)

    var isLoaded: Bool {
        guard case .loaded = self else { return false }
        return true
    }
}
