import Foundation

private let millisecondsPerSecond: Double = 1_000

private func dateOfMilliseconds(decoder: any Decoder) throws -> Date {
    let milliseconds = try decoder.singleValueContainer().decode(Int64.self)
    return Date(timeIntervalSince1970: Double(milliseconds) / millisecondsPerSecond)
}

enum OwnerCoding {
    static func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .custom(dateOfMilliseconds)
        return decoder
    }

    static func encoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        return encoder
    }
}
