public enum LinkSource: Sendable, CaseIterable {
    case widget
    case morningGlance

    public var openingFocus: OpeningFocus {
        switch self {
        case .widget: .addField
        case .morningGlance: .list
        }
    }
}

public enum OpeningFocus: Sendable {
    case addField
    case list
}
