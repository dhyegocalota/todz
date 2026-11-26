import Foundation

public struct UsageRollup: Codable, Equatable, Sendable {
    public static let countMax = 10_000
    public static let path = "/telemetry/usage"

    public let installId: String
    public let appVersion: String
    public let macosMajor: Int
    public let counts: [String: Int]

    public init(installId: String, appVersion: String, macosMajor: Int, tally: [UsageEvent: Int]) {
        self.installId = installId
        self.appVersion = appVersion
        self.macosMajor = macosMajor
        counts = Dictionary(uniqueKeysWithValues: tally.map { event, count in (event.rawValue, min(count, Self.countMax)) })
    }

    public func request(baseURL: URL) throws -> URLRequest {
        var request = URLRequest(url: baseURL.appending(path: Self.path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        request.httpBody = try encoder.encode(self)
        return request
    }
}
