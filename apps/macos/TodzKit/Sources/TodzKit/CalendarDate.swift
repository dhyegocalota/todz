private let separator: Character = "-"

public struct CalendarDate: Decodable, Sendable, Hashable {
    public let year: Int
    public let month: Int
    public let day: Int

    public init(year: Int, month: Int, day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }

    public init?(text: String) {
        let parts = text.split(separator: separator).compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        self.init(year: parts[0], month: parts[1], day: parts[2])
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        let text = try container.decode(String.self)
        guard let date = CalendarDate(text: text) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "a due date is not a calendar date")
        }
        self = date
    }
}
