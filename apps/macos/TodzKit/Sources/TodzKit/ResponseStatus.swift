enum ResponseStatus: Int {
    case badRequest = 400
    case unauthorized = 401
    case notFound = 404
    case unavailable = 503

    static let successes = 200..<300
}
