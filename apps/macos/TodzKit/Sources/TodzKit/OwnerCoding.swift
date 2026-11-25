import Foundation

let millisecondsPerSecond: Double = 1_000

private func dateOfMilliseconds(decoder: any Decoder) throws -> Date {
    let milliseconds = try decoder.singleValueContainer().decode(Int64.self)
    return Date(timeIntervalSince1970: Double(milliseconds) / millisecondsPerSecond)
}

private func millisecondsOfDate(date: Date, encoder: any Encoder) throws {
    var container = encoder.singleValueContainer()
    try container.encode(Int64((date.timeIntervalSince1970 * millisecondsPerSecond).rounded()))
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
        encoder.dateEncodingStrategy = .custom(millisecondsOfDate)
        return encoder
    }
}
