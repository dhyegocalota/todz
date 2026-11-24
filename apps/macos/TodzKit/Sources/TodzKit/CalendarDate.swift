public struct CalendarDate: Decodable, Sendable, Hashable {
    public let year: Int
    public let month: Int
    public let day: Int

    public init(year: Int, month: Int, day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }

    public init(from decoder: any Decoder) throws {
        fatalError("CalendarDate decoding is not implemented")
    }
}
