public enum TaskPlacement: Encodable, Sendable, Equatable {
    case first
    case after(anchor: Int)

    enum CodingKeys: String, CodingKey {
        case kind
        case anchor
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
