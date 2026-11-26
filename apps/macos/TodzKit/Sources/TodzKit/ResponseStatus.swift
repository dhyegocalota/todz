enum ResponseStatus: Int {
    case unauthorized = 401
    case tooManyRequests = 429
    case notFound = 404
    case unavailable = 503
    case upgradeRequired = 426

    static let successes = 200..<300
}
