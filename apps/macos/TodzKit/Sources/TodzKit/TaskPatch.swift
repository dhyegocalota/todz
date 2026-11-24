public enum TaskPatch: Encodable, Sendable, Equatable {
    case title(String)
    case notes(String?)
    case dueDate(CalendarDate?)
    case placement(TaskPlacement)

    enum CodingKeys: String, CodingKey {
        case title
        case notes
        case dueDate
        case placement
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .title(title):
            try container.encode(title, forKey: .title)
        case let .notes(notes):
            try container.encode(notes, forKey: .notes)
        case let .dueDate(dueDate):
            try container.encode(dueDate, forKey: .dueDate)
        case let .placement(placement):
            try container.encode(placement, forKey: .placement)
        }
    }
}
