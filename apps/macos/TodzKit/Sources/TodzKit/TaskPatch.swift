private let oneFieldDescription = "A task patch holds exactly one field."

public enum TaskPatch: Codable, Sendable, Equatable {
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

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        guard let key = container.allKeys.first, container.allKeys.count == 1 else {
            throw DecodingError.dataCorrupted(DecodingError.Context(codingPath: decoder.codingPath, debugDescription: oneFieldDescription))
        }
        switch key {
        case .title:
            self = .title(try container.decode(String.self, forKey: .title))
        case .notes:
            self = .notes(try container.decodeIfPresent(String.self, forKey: .notes))
        case .dueDate:
            self = .dueDate(try container.decodeIfPresent(CalendarDate.self, forKey: .dueDate))
        case .placement:
            self = .placement(try container.decode(TaskPlacement.self, forKey: .placement))
        }
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

    var writeField: TaskWriteField {
        switch self {
        case .title: .title
        case .notes: .notes
        case .dueDate: .dueDate
        case .placement: .order
        }
    }
}
