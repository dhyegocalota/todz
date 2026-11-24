private let unplacedKindDescription = "A task placement is first or after an anchor."

public enum TaskPlacement: Codable, Sendable, Equatable {
    case first
    case after(anchor: Int)

    enum CodingKeys: String, CodingKey {
        case kind
        case anchor
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(PlacementKind.self, forKey: .kind) {
        case .first:
            self = .first
        case .after:
            self = .after(anchor: try container.decode(Int.self, forKey: .anchor))
        case .last, .before:
            throw DecodingError.dataCorruptedError(forKey: .kind, in: container, debugDescription: unplacedKindDescription)
        }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .first:
            try container.encode(PlacementKind.first, forKey: .kind)
        case let .after(anchor):
            try container.encode(PlacementKind.after, forKey: .kind)
            try container.encode(anchor, forKey: .anchor)
        }
    }
}
