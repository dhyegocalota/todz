private let firstDelay: Duration = .seconds(1)
private let longestDelay: Duration = .seconds(30)
private let doublingLimit = 5

public enum ReconnectDelay {
    public static func after(attempt: Int) -> Duration {
        let doublings = min(max(attempt, 1) - 1, doublingLimit)
        return min(firstDelay * (1 << doublings), longestDelay)
    }
}
